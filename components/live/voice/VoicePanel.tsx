"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  HeadphoneOff,
  Headphones,
  Maximize2,
  Mic,
  MicOff,
  Minimize2,
  MonitorUp,
  Music,
  Smartphone,
  Video,
  VideoOff,
  Volume2,
  X,
} from "lucide-react";
import { SCREEN_AUDIO_HINT, SCREEN_SHARE_MESSAGE, screenAudioSupport, screenShareSupport } from "@/lib/client/media";
import { callStartedAt, displayName, useStore } from "@/lib/client/store";
import { useTheme } from "@/lib/client/theme";
import { Perm, hasPerm, type ApiVoiceState } from "@/lib/client/types";
import { formatCallDuration } from "@/lib/client/voice";
import { CallTimer } from "./CallTimer";
import { CallWindow, useIsDesktop } from "./CallWindow";
import { LeaveButton } from "./LeaveButton";
import { PipPanel } from "./PipPanel";
import { useParticipantPip } from "./useParticipantPip";
import { useVoiceRoom } from "./useVoiceRoom";

const ENDED_NOTICE_MS = 6000;

export function VoicePanel({
  voice,
  elsewhere,
  kicked,
  muted,
  deaf,
  slot,
  mobileBar,
  focusSignal,
  sessionId,
  onLeave,
  onTakeOver,
  onReplaced,
  onMute,
  onDeaf,
}: {
  voice: ApiVoiceState | null; // só a chamada deste dispositivo
  elsewhere: ApiVoiceState | null; // a conta está em chamada em outro dispositivo
  kicked: boolean; // estava aqui e outro dispositivo assumiu
  muted: boolean;
  deaf: boolean;
  slot: HTMLElement | null; // onde os botões aparecem (rodapé da barra lateral)
  mobileBar: HTMLElement | null; // barra de chamada do celular
  focusSignal: number; // muda quando a chamada deve vir para a frente
  sessionId: string;
  onLeave: () => void;
  onTakeOver: () => void;
  onReplaced: () => void;
  onMute: () => void;
  onDeaf: () => void;
}) {
  const { state } = useStore();
  const guild = voice ? state.guilds[voice.guild_id] : undefined;
  const sounds = guild?.sounds ?? [];
  const audioBox = useRef<HTMLDivElement>(null);
  const call = useVoiceRoom({
    audioBox,
    channelId: voice?.channel_id ?? null,
    sessionId,
    myId: state.me?.id,
    muted,
    deaf,
    serverMuted: !!voice?.mute,
    sounds,
    onReplaced,
  });
  const theme = useTheme();
  const people = useMemo(
    () =>
      call.tiles
        .filter((t) => t.kind === "camera")
        .map((t) => ({ id: t.identity, name: t.local ? "Você" : displayName(state.users[t.identity]), speaking: t.speaking, micOn: t.micOn })),
    [call.tiles, state.users],
  );
  const pip = useParticipantPip({ inCall: !!voice, people, theme, onLeave, onMute });
  const desktop = useIsDesktop();
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [boardOpen, setBoardOpen] = useState(false);
  const [screenSupport] = useState(screenShareSupport);
  const [seenFocus, setSeenFocus] = useState(focusSignal);
  if (seenFocus !== focusSignal) {
    setSeenFocus(focusSignal);
    setOpen(true);
  }

  // Abre sozinha quando o primeiro vídeo aparece, mas dá pra fechar. No celular só abre
  // se pedir, porque o sheet cobriria o campo de mensagem.
  const videoCount = call.tiles.filter((t) => t.video).length;
  const [seenVideos, setSeenVideos] = useState(0);
  if (seenVideos !== videoCount) {
    setSeenVideos(videoCount);
    if (seenVideos === 0 && desktop) setOpen(true);
  }

  // sair da chamada fecha a janela junto
  const [seenChannel, setSeenChannel] = useState(voice?.channel_id ?? null);
  if (seenChannel !== (voice?.channel_id ?? null)) {
    setSeenChannel(voice?.channel_id ?? null);
    setOpen(false);
    setExpanded(false);
    setBoardOpen(false);
  }

  // Ao sair, mostra por alguns segundos quanto durou. Passar a chamada para outro aparelho não conta.
  const startedAt = callStartedAt(guild, voice?.channel_id);
  const inCall = !!voice;
  const movedAway = !!elsewhere;
  const lastStart = useRef<number | null>(null);
  const [ended, setEnded] = useState<string | null>(null);
  useEffect(() => {
    if (inCall) {
      lastStart.current = startedAt;
      return;
    }
    const start = lastStart.current;
    lastStart.current = null;
    if (start != null && !movedAway) setEnded(formatCallDuration(Date.now() - start));
  }, [inCall, startedAt, movedAway]);
  useEffect(() => {
    if (!ended) return;
    const timer = setTimeout(() => setEnded(null), ENDED_NOTICE_MS);
    return () => clearTimeout(timer);
  }, [ended]);

  // Esc na tela cheia nativa não chega como tecla: é aqui que o modo expandido descobre
  useEffect(() => {
    const onChange = () => {
      if (!document.fullscreenElement) setExpanded(false);
    };
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  // A página inteira entra em tela cheia, dentro do clique; quem não tem isso (iPhone)
  // fica com o modo expandido, que já ocupa a tela toda.
  function expand() {
    setExpanded(true);
    document.documentElement.requestFullscreen?.().catch(() => {});
  }

  function collapse() {
    setExpanded(false);
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  }

  if (!voice) {
    const where = elsewhere && state.guilds[elsewhere.guild_id];
    const channel = where?.channels.find((c) => c.id === elsewhere?.channel_id);
    const notice = (
      <div className="flex items-center gap-2 border-t border-line bg-paper-3/40 px-3 py-2">
        <Smartphone size={16} className="shrink-0 text-muted" />
        <span className="min-w-0 flex-1 leading-tight">
          <span className="block text-xs font-semibold">
            {kicked ? "Você entrou em outro dispositivo" : "Em chamada em outro dispositivo"}
          </span>
          {channel && (
            <span className="block truncate text-xs text-muted">
              {channel.name} / {where?.name}
            </span>
          )}
        </span>
        <button onClick={onTakeOver} className="shrink-0 rounded-lg border border-line px-2 py-1 text-xs font-semibold hover:border-line-strong">
          Trazer pra cá
        </button>
        <LeaveButton onLeave={onLeave} label="never" />
      </div>
    );
    const endedNotice = ended && (
      <p className="border-t border-line bg-paper-3/40 px-3 py-2 text-xs font-semibold" role="status" data-call-ended>
        Chamada encerrada · duração <span className="tabular-nums">{ended}</span>
      </p>
    );
    return (
      <>
        <div ref={audioBox} className="hidden" />
        {elsewhere && slot && createPortal(notice, slot)}
        {elsewhere && mobileBar && createPortal(notice, mobileBar)}
        {endedNotice && slot && createPortal(endedNotice, slot)}
        {endedNotice && mobileBar && createPortal(endedNotice, mobileBar)}
      </>
    );
  }

  const channel = guild?.channels.find((c) => c.id === voice.channel_id);
  const live = call.status === "connected";
  const canPlaySounds = hasPerm(guild?.permissions, Perm.USE_SOUNDBOARD);
  const statusText =
    call.status === "connecting"
      ? "Conectando o áudio…"
      : call.status === "unavailable"
        ? "Áudio não configurado no servidor"
        : call.status === "error"
          ? "Áudio caiu. Sai e entra de novo."
          : !live
            ? ""
            : voice.mute
              ? "Silenciado por um moderador"
              : call.micBlocked
                ? "Sem acesso ao microfone. Libera no navegador."
                : `Áudio ligado • ${people.length} na sala`;

  const btn = (on: boolean) =>
    `flex h-8 flex-1 items-center justify-center rounded-lg border ${
      on ? "border-signal bg-signal text-on-signal" : "border-line text-ink-3 hover:border-line-strong hover:text-ink"
    } disabled:opacity-40`;

  async function toggleCamera() {
    if (await call.toggleCamera()) setOpen(true);
  }

  async function toggleScreen() {
    if (await call.toggleScreen()) setOpen(true);
  }

  function toggleBoard() {
    setBoardOpen((v) => !v);
    setOpen(true);
  }

  const alerts = (
    <>
      {call.audioBlocked && (
        <button
          onClick={call.startAudio}
          className="mb-1.5 flex w-full items-center justify-center gap-1.5 rounded-lg bg-signal px-2 py-1.5 text-xs font-semibold text-on-signal"
        >
          <Volume2 size={14} /> Ativar áudio
        </button>
      )}
      {call.notice && (
        <p className="mb-1.5 flex items-start gap-1.5 rounded-lg bg-mustard/25 px-2 py-1.5 text-xs text-ink">
          <span className="min-w-0 flex-1">{call.notice}</span>
          <button aria-label="Dispensar aviso" onClick={call.clearNotice} className="shrink-0">
            <X size={13} />
          </button>
        </p>
      )}
    </>
  );

  return (
    <>
      <div ref={audioBox} className="hidden" />
      {pip.pipWindow &&
        createPortal(
          <PipPanel
            people={people}
            title={channel?.name ?? "Chamada"}
            status={statusText}
            startedAt={startedAt}
            muted={muted}
            deaf={deaf}
            accent={guild?.accent_color}
            theme={theme}
            onMute={onMute}
            onDeaf={onDeaf}
            onLeave={onLeave}
          />,
          pip.pipWindow.document.body,
        )}
      {slot &&
        createPortal(
          <div className="border-t border-line bg-paper-3/40 px-2 py-2">
            {alerts}
            <div className="mb-1.5 flex items-start gap-1.5 px-1">
              <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${live ? "bg-online" : "bg-faint"}`} aria-hidden />
              <span className="min-w-0 flex-1 leading-tight">
                <span className={`block text-xs ${live ? "font-semibold text-online" : "text-muted"}`}>{statusText}</span>
                {channel && (
                  <span className="flex items-center gap-1.5 text-xs text-muted">
                    <span className="min-w-0 truncate">
                      {channel.name} / {guild?.name}
                    </span>
                    <CallTimer startedAt={startedAt} />
                  </span>
                )}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <button className={btn(call.camera)} disabled={!live} onClick={toggleCamera} aria-label={call.camera ? "Desligar câmera" : "Ligar câmera"}>
                {call.camera ? <VideoOff size={16} /> : <Video size={16} />}
              </button>
              {screenSupport === "ok" && (
                <button className={btn(call.screen)} disabled={!live} onClick={toggleScreen} aria-label={call.screen ? "Parar de compartilhar" : "Compartilhar tela"} title={call.screen ? undefined : SCREEN_AUDIO_HINT[screenAudioSupport()]}>
                  <MonitorUp size={16} />
                </button>
              )}
              {canPlaySounds && (
                <button className={btn(boardOpen)} disabled={!live} onClick={toggleBoard} aria-label="Soundboard">
                  <Music size={16} />
                </button>
              )}
              <button className={btn(open)} disabled={!live} onClick={() => setOpen((v) => !v)} aria-label={open ? "Esconder chamada" : "Ver chamada"}>
                {open ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
              </button>
              <LeaveButton onLeave={onLeave} className="md:h-8" />
            </div>
            {screenSupport !== "ok" && <p className="mt-1.5 px-1 text-[11px] leading-snug text-muted">{SCREEN_SHARE_MESSAGE[screenSupport]}</p>}
          </div>,
          slot,
        )}

      {mobileBar &&
        createPortal(
          <div className="border-b border-line bg-paper-2 px-2 py-1.5 text-ink">
            {alerts}
            <div className="flex items-center gap-1.5">
              <button onClick={() => live && setOpen((v) => !v)} className="flex min-w-0 flex-1 items-center gap-1.5 text-left leading-tight">
                <span className={`h-2 w-2 shrink-0 rounded-full ${live ? "bg-online" : "bg-faint"}`} aria-hidden />
                <span className="min-w-0">
                  <span className={`block truncate text-xs ${live ? "font-semibold text-online" : "text-muted"}`}>{statusText}</span>
                  {channel && (
                    <span className="flex items-center gap-1.5 text-xs text-muted">
                      <span className="min-w-0 truncate">{channel.name} / {guild?.name}</span>
                      <CallTimer startedAt={startedAt} />
                    </span>
                  )}
                </span>
              </button>
              <button
                aria-label={muted ? "Ativar microfone" : "Silenciar"}
                onClick={onMute}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-ink-3 hover:bg-paper-3"
              >
                {muted ? <MicOff size={18} className="text-dnd" /> : <Mic size={18} />}
              </button>
              <button
                aria-label={deaf ? "Voltar a ouvir" : "Ensurdecer"}
                onClick={onDeaf}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-ink-3 hover:bg-paper-3"
              >
                {deaf ? <HeadphoneOff size={18} className="text-dnd" /> : <Headphones size={18} />}
              </button>
              <span className="mx-1 h-7 w-px shrink-0 bg-line" aria-hidden />
              <LeaveButton onLeave={onLeave} label="roomy" />
            </div>
          </div>,
          mobileBar,
        )}

      {live && guild && (
        <CallWindow
          open={open}
          expanded={expanded}
          onClose={() => setOpen(false)}
          onExpand={expand}
          onCollapse={collapse}
          tiles={call.tiles}
          startedAt={startedAt}
          guildId={guild.id}
          sounds={sounds}
          canPlaySounds={canPlaySounds}
          boardOpen={boardOpen}
          cooling={call.cooling}
          onToggleBoard={() => setBoardOpen((v) => !v)}
          onPlay={call.sendSound}
          onLeave={onLeave}
          pip={{ mode: pip.mode, active: pip.active, error: pip.error, onToggle: pip.toggle }}
          sheetFooter={
            <>
              <button
                onClick={toggleCamera}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-chrome-2 py-2.5 text-sm font-semibold text-on-chrome"
              >
                {call.camera ? <VideoOff size={16} /> : <Video size={16} />}
                {call.camera ? "Desligar câmera" : "Ligar câmera"}
              </button>
              {screenSupport !== "ok" && <p className="mt-2 px-1 text-xs leading-snug text-on-chrome-muted">{SCREEN_SHARE_MESSAGE[screenSupport]}</p>}
            </>
          }
        />
      )}
    </>
  );
}
