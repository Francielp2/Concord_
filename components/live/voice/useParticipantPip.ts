"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ThemeId } from "@/lib/client/theme";

export type PipMode = "document" | "video" | "none";
export type PipPerson = { id: string; name: string; speaking: boolean; micOn: boolean };

type DocumentPip = { requestWindow: (options: { width: number; height: number }) => Promise<Window> };

const WINDOW_SIZE = { width: 320, height: 420 };
const CANVAS_W = 480;
const CANVAS_H = 320;
const ROW_H = 46;
const MAX_ROWS = 6;
const REDRAW_MS = 1000;

export const PIP_UNSUPPORTED = "Seu navegador não consegue destacar a janela da chamada. Funciona no Chrome e no Edge do computador.";

const documentPip = () => (window as unknown as { documentPictureInPicture?: DocumentPip }).documentPictureInPicture;

export function pipSupport(): PipMode {
  if (documentPip()) return "document";
  const canVideo = document.pictureInPictureEnabled && "captureStream" in HTMLCanvasElement.prototype;
  return canVideo ? "video" : "none";
}

// nem todo navegador conhece essas ações, e alguns lançam erro em vez de ignorar
function setSessionAction(action: string, handler: (() => void) | null) {
  try {
    navigator.mediaSession?.setActionHandler(action as MediaSessionAction, handler);
  } catch {}
}

function applyTheme(win: Window, theme: ThemeId) {
  win.document.documentElement.dataset.theme = theme;
}

// Copia as regras já carregadas (<link> e <style>): sem esperar nova requisição, a janela nasce pronta.
// Folha de outro domínio não deixa ler as regras, então vai pelo endereço.
function copyStyles(target: Document) {
  for (const sheet of document.styleSheets) {
    try {
      const style = target.createElement("style");
      style.textContent = [...sheet.cssRules].map((rule) => rule.cssText).join("\n");
      target.head.appendChild(style);
    } catch {
      if (!sheet.href) continue;
      const link = target.createElement("link");
      link.rel = "stylesheet";
      link.href = sheet.href;
      target.head.appendChild(link);
    }
  }
  target.documentElement.className = document.documentElement.className;
}

// Sem fotos de propósito: imagem de outro domínio "suja" o canvas, e aí captureStream falha.
function drawPeople(canvas: HTMLCanvasElement, people: PipPerson[]) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const css = getComputedStyle(document.documentElement);
  const token = (name: string) => css.getPropertyValue(name).trim();
  ctx.fillStyle = token("--color-chrome");
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  ctx.textBaseline = "middle";
  ctx.fillStyle = token("--color-on-chrome-muted");
  ctx.font = "600 18px system-ui, sans-serif";
  ctx.fillText(`${people.length} na chamada`, 20, 26);
  people.slice(0, MAX_ROWS).forEach((p, i) => {
    const y = 72 + i * ROW_H;
    ctx.beginPath();
    ctx.arc(38, y, 17, 0, Math.PI * 2);
    ctx.fillStyle = token("--color-chrome-3");
    ctx.fill();
    if (p.speaking) {
      ctx.lineWidth = 3;
      ctx.strokeStyle = token("--color-online");
      ctx.stroke();
    }
    ctx.fillStyle = token("--color-on-chrome");
    ctx.font = "700 15px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText((p.name[0] ?? "?").toUpperCase(), 38, y);
    ctx.textAlign = "left";
    ctx.font = "500 20px system-ui, sans-serif";
    ctx.fillText(p.name.length > 26 ? `${p.name.slice(0, 25)}…` : p.name, 68, y);
    if (!p.micOn) {
      ctx.fillStyle = token("--color-on-chrome-muted");
      ctx.font = "500 16px system-ui, sans-serif";
      ctx.textAlign = "right";
      ctx.fillText("mudo", CANVAS_W - 20, y);
      ctx.textAlign = "left";
    }
  });
  if (people.length > MAX_ROWS) {
    ctx.fillStyle = token("--color-on-chrome-muted");
    ctx.font = "500 16px system-ui, sans-serif";
    ctx.fillText(`e mais ${people.length - MAX_ROWS}`, 20, CANVAS_H - 12);
  }
}

// Janela flutuante dos participantes. O áudio não passa por aqui: continua nos elementos da aba
// principal, e fechar a janela não mexe na chamada.
export function useParticipantPip({
  inCall,
  people,
  theme,
  onLeave,
  onMute,
}: {
  inCall: boolean;
  people: PipPerson[];
  theme: ThemeId;
  onLeave: () => void;
  onMute: () => void;
}) {
  const [mode] = useState<PipMode>(pipSupport);
  const [pipWindow, setPipWindow] = useState<Window | null>(null);
  const [videoOpen, setVideoOpen] = useState(false);
  const [error, setError] = useState("");
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const latest = useRef({ people, onLeave, onMute });
  useEffect(() => {
    latest.current = { people, onLeave, onMute };
  });

  const stopVideo = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    videoRef.current = null;
    canvasRef.current = null;
    (video.srcObject as MediaStream | null)?.getTracks().forEach((t) => t.stop());
    video.remove();
    setSessionAction("hangup", null);
    setSessionAction("togglemicrophone", null);
    setVideoOpen(false);
  }, []);

  const close = useCallback(() => {
    setError("");
    pipWindow?.close();
    if (videoRef.current && document.pictureInPictureElement === videoRef.current) document.exitPictureInPicture().catch(() => {});
    stopVideo();
  }, [pipWindow, stopVideo]);

  async function openDocument() {
    const win = await documentPip()!.requestWindow(WINDOW_SIZE);
    copyStyles(win.document);
    win.document.title = "Chamada · Concord";
    win.addEventListener("pagehide", () => setPipWindow(null), { once: true });
    setPipWindow(win);
  }

  async function openVideo() {
    const canvas = document.createElement("canvas");
    canvas.width = CANVAS_W;
    canvas.height = CANVAS_H;
    drawPeople(canvas, latest.current.people);
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.srcObject = canvas.captureStream(4);
    video.style.cssText = "position:fixed;width:1px;height:1px;opacity:0;pointer-events:none";
    document.body.appendChild(video);
    canvasRef.current = canvas;
    videoRef.current = video;
    video.addEventListener("leavepictureinpicture", stopVideo, { once: true });
    try {
      await video.play();
      await video.requestPictureInPicture();
    } catch (err) {
      stopVideo();
      throw err;
    }
    // vídeo não tem botões: o que o navegador oferecer na janelinha vem por aqui
    setSessionAction("hangup", () => latest.current.onLeave());
    setSessionAction("togglemicrophone", () => latest.current.onMute());
    setVideoOpen(true);
  }

  async function toggle() {
    if (pipWindow || videoOpen) return close();
    setError("");
    try {
      await (mode === "document" ? openDocument() : openVideo());
    } catch (err) {
      console.error("[concord] janela destacada", err);
      setError("Não deu pra destacar a janela. Tenta de novo.");
    }
  }

  // o canvas só gera quadro novo quando é desenhado, e aba em segundo plano segura timers curtos
  useEffect(() => {
    if (!videoOpen) return;
    const draw = () => canvasRef.current && drawPeople(canvasRef.current, latest.current.people);
    const timer = setInterval(draw, REDRAW_MS);
    return () => clearInterval(timer);
  }, [videoOpen]);

  // a janela acompanha o tema
  useEffect(() => {
    if (pipWindow) applyTheme(pipWindow, theme);
  }, [pipWindow, theme]);

  // saiu da chamada ou a página foi embora: não sobra janela aberta
  const closeRef = useRef(close);
  useEffect(() => {
    closeRef.current = close;
  });
  useEffect(() => {
    if (!inCall) closeRef.current();
  }, [inCall]);
  useEffect(() => () => closeRef.current(), []);

  return { mode, pipWindow, active: !!pipWindow || videoOpen, error, toggle };
}
