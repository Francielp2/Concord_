"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/client/api";
import { closeNotification, showNotification, useDocumentVisible } from "@/lib/client/notifications";
import { startRingtone, unlockAudio } from "@/lib/client/sounds";
import { displayName, dmName, useStore } from "@/lib/client/store";
import type { ApiChannel, ApiUser } from "@/lib/client/types";
import { formatCallDuration } from "@/lib/client/voice";

export const RING_MS = 30_000;
const NOTICE_MS = 8000;

export type DmCall = { id: string; channelId: string; phase: "calling" | "active"; startedAt: number | null };
export type IncomingCall = { id: string; channelId: string; caller: ApiUser; expiresAt: number };

const signal = (action: "ring" | "accept" | "decline" | "end", channelId: string, callId?: string) =>
  api<{ call_id: string; at: number }>("/voice/dm-call", { body: { action, channel_id: channelId, ...(callId ? { call_id: callId } : {}) } });

const friendlyCallError = (err: unknown) => {
  const code = (err as { status?: number }).status;
  if (code === 403) return "Não dá para ligar para essa pessoa.";
  if (code === 429) return "Muitas tentativas. Espera um pouco.";
  return "Não deu para fazer a chamada. Tenta de novo.";
};

// Chamada particular: só sinal entre os aparelhos, sem nada no banco. O toque expira em cada cliente.
// `onBegin` tira a pessoa de uma chamada de servidor antes de abrir a sala da DM.
export function useDmCall({ onBegin, onFocus }: { onBegin: () => void; onFocus: () => void }) {
  const { state, onGateway } = useStore();
  const [call, setCall] = useState<DmCall | null>(null);
  const [incoming, setIncoming] = useState<IncomingCall[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const visible = useDocumentVisible();
  const head = incoming[0] ?? null;

  const latest = useRef({ call, incoming, state, onBegin, onFocus });
  useEffect(() => {
    latest.current = { call, incoming, state, onBegin, onFocus };
  });

  const quiet = () => {
    const status = latest.current.state.myStatus;
    return status === "dnd" || status === "invisible";
  };

  const missed = useCallback((list: IncomingCall[]) => {
    if (!list.length) return;
    setNotice("Chamada perdida");
    const last = list[list.length - 1];
    if (!quiet()) {
      showNotification({
        title: "Chamada perdida",
        body: `${displayName(last.caller)} tentou te ligar.`,
        icon: last.caller.avatar,
        tag: `missed-${last.channelId}`,
        data: { kind: "missed", channelId: last.channelId },
      });
    }
  }, []);

  useEffect(
    () =>
      onGateway((type, d) => {
        if (!type.startsWith("CALL_")) return;
        const { call: current, state: s } = latest.current;
        const me = s.me?.id;
        const channelId = d.channel_id as string;
        const callId = d.call_id as string;
        const at = d.at as number;

        if (type === "CALL_RING") {
          const caller = d.caller as ApiUser;
          const age = Date.now() - at;
          // ao reconectar o gateway reenvia o que passou: toque velho não toca de novo
          if (caller.id === me || age > RING_MS) return;
          // já estou nessa conversa (ligamos juntos, ou a pessoa voltou à sala): é só juntar
          if (current?.channelId === channelId) {
            signal("accept", channelId, callId).catch(() => {});
            setCall({ ...current, phase: "active", startedAt: current.startedAt ?? at });
            return;
          }
          setIncoming((list) =>
            list.some((c) => c.id === callId) ? list : [...list, { id: callId, channelId, caller, expiresAt: Date.now() + RING_MS - Math.max(0, age) }],
          );
          return;
        }

        const fromMe = d.user_id === me;
        if (type === "CALL_ACCEPT") {
          // atendeu em outro aparelho: para de tocar aqui, sem contar como perdida
          if (fromMe) setIncoming((list) => list.filter((c) => c.id !== callId));
          else if (current?.channelId === channelId && current.phase === "calling") {
            setCall({ ...current, phase: "active", startedAt: at });
          }
        } else if (type === "CALL_DECLINE") {
          if (fromMe) setIncoming((list) => list.filter((c) => c.id !== callId));
          else if (current?.channelId === channelId && current.phase === "calling") {
            setCall(null);
            setNotice("Chamada recusada");
          }
        } else if (type === "CALL_END") {
          // quem ligou desistiu antes de atenderem. Na conversa em andamento quem decide é a sala:
          // o outro sair deixa a pessoa sozinha, e aí conta o tempo de encerrar.
          const gone = latest.current.incoming.filter((c) => c.id === callId);
          if (gone.length) {
            setIncoming((list) => list.filter((c) => c.id !== callId));
            if (!fromMe) missed(gone);
          }
        }
      }),
    [onGateway, missed],
  );

  // quem liga: sem resposta em 30s
  const callingId = call?.phase === "calling" ? call.id : null;
  const callingChannel = call?.channelId;
  useEffect(() => {
    if (!callingId || !callingChannel) return;
    const timer = setTimeout(() => {
      setCall(null);
      setNotice("Sem resposta");
      if (callingId !== "pending") signal("end", callingChannel, callingId).catch(() => {});
    }, RING_MS);
    return () => clearTimeout(timer);
  }, [callingId, callingChannel]);

  // Fechar a página enquanto chama cancela o toque. Em chamada não: recarregar a página tem volta.
  useEffect(() => {
    if (!callingId || !callingChannel || callingId === "pending") return;
    const leave = () => navigator.sendBeacon("/api/v1/voice/dm-call", JSON.stringify({ action: "end", channel_id: callingChannel, call_id: callingId }));
    window.addEventListener("pagehide", leave);
    return () => window.removeEventListener("pagehide", leave);
  }, [callingId, callingChannel]);

  // quem recebe: cada toque expira sozinho
  useEffect(() => {
    if (!incoming.length) return;
    const next = Math.min(...incoming.map((c) => c.expiresAt));
    const timer = setTimeout(() => {
      const now = Date.now();
      missed(incoming.filter((c) => c.expiresAt <= now));
      setIncoming((list) => list.filter((c) => c.expiresAt > now));
    }, Math.max(0, next - Date.now()));
    return () => clearTimeout(timer);
  }, [incoming, missed]);

  // um toque por vez: o próximo da fila só começa quando este resolver
  const headId = head?.id ?? null;
  const headCaller = head?.caller;
  const headChannel = head?.channelId;
  useEffect(() => {
    if (!headId || !headCaller) return;
    const silent = quiet();
    const stop = startRingtone({ silent });
    const tag = `call-${headId}`;
    if (!silent && (document.visibilityState !== "visible" || !document.hasFocus())) {
      showNotification({
        title: `${displayName(headCaller)} está ligando`,
        body: "Chamada no Concord",
        icon: headCaller.avatar,
        tag,
        data: { kind: "call", callId: headId, channelId: headChannel },
        actions: [
          { action: "accept", title: "Atender" },
          { action: "decline", title: "Recusar" },
        ],
        requireInteraction: true,
        vibrate: [400, 200, 400],
      });
    }
    return () => {
      stop();
      closeNotification(tag);
    };
  }, [headId, headCaller, headChannel]);

  useEffect(() => {
    if (!notice || !visible) return;
    const timer = setTimeout(() => setNotice(null), NOTICE_MS);
    return () => clearTimeout(timer);
  }, [notice, visible]);

  const hangup = useCallback((message?: string) => {
    const current = latest.current.call;
    if (!current) return;
    setCall(null);
    const lasted = current.startedAt != null ? ` · duração ${formatCallDuration(Date.now() - current.startedAt)}` : "";
    setNotice(message ?? (current.phase === "active" ? `Chamada encerrada${lasted}` : null));
    if (current.id !== "pending") signal("end", current.channelId, current.id).catch(() => {});
  }, []);

  // o outro aparelho assumiu: só limpa aqui, a chamada continua lá
  const replaced = useCallback(() => {
    setCall(null);
    setNotice("A chamada continuou em outro dispositivo");
  }, []);

  const accept = useCallback(
    async (callId?: string) => {
      const target = callId ? latest.current.incoming.find((c) => c.id === callId) : latest.current.incoming[0];
      if (!target) return;
      unlockAudio();
      if (latest.current.call) hangup();
      latest.current.onBegin();
      setIncoming((list) => list.filter((c) => c.id !== target.id));
      setCall({ id: target.id, channelId: target.channelId, phase: "active", startedAt: Date.now() });
      latest.current.onFocus();
      try {
        const { at } = await signal("accept", target.channelId, target.id);
        setCall((c) => (c?.id === target.id ? { ...c, startedAt: at } : c));
      } catch (err) {
        setCall((c) => (c?.id === target.id ? null : c));
        setNotice(friendlyCallError(err));
      }
    },
    [hangup],
  );

  const decline = useCallback((callId?: string) => {
    const target = callId ? latest.current.incoming.find((c) => c.id === callId) : latest.current.incoming[0];
    if (!target) return;
    setIncoming((list) => list.filter((c) => c.id !== target.id));
    signal("decline", target.channelId, target.id).catch(() => {});
  }, []);

  const start = useCallback(
    async (channelId: string) => {
      unlockAudio();
      const { call: current, incoming: queue } = latest.current;
      if (current?.channelId === channelId) return latest.current.onFocus();
      // a pessoa já está ligando: apertar o botão é atender
      const ringing = queue.find((c) => c.channelId === channelId);
      if (ringing) return accept(ringing.id);
      if (current) hangup();
      latest.current.onBegin();
      setCall({ id: "pending", channelId, phase: "calling", startedAt: null });
      latest.current.onFocus();
      try {
        const res = await signal("ring", channelId);
        setCall((c) => (c?.channelId === channelId && c.id === "pending" ? { ...c, id: res.call_id } : c));
      } catch (err) {
        setCall((c) => (c?.channelId === channelId && c.id === "pending" ? null : c));
        setNotice(friendlyCallError(err));
      }
    },
    [accept, hangup],
  );

  const channel: ApiChannel | undefined = call ? state.dms[call.channelId] : undefined;
  return {
    call,
    title: channel ? dmName(state, channel) : "Chamada",
    head,
    queued: Math.max(0, incoming.length - 1),
    notice,
    clearNotice: () => setNotice(null),
    start,
    accept,
    decline,
    hangup,
    replaced,
  };
}
