"use client";

import { useEffect, useRef, useState } from "react";
import { Bell, X } from "lucide-react";
import { closeNotification, notificationsSupported, requestNotifications, showNotification, useDocumentVisible, useNotificationPermission } from "@/lib/client/notifications";
import { playMessageCue, unlockAudio } from "@/lib/client/sounds";
import { displayName, isMentioned, useStore, type State } from "@/lib/client/store";
import type { ApiMessage } from "@/lib/client/types";

const INVITE_KEY = "concord:notify-invite-seen";
const CUE_GAP_MS = 1200;
const SNIPPET = 120;

// Trecho legível: menção e emoji do servidor chegam como <@id> e <:nome:id>.
function snippet(s: State, m: ApiMessage) {
  const text = m.content
    .replace(/<@!?(\d+)>/g, (_, id) => `@${displayName(s.users[id])}`)
    .replace(/<a?:(\w+):\d+>/g, ":$1:")
    .replace(/<@&\d+>/g, "@cargo")
    .replace(/<#\d+>/g, "#canal")
    .trim();
  if (text) return text.length > SNIPPET ? `${text.slice(0, SNIPPET)}…` : text;
  return m.attachments?.length ? "Enviou um anexo" : "Nova mensagem";
}

function channelOf(s: State, m: ApiMessage) {
  return m.guild_id ? s.guilds[m.guild_id]?.channels.find((c) => c.id === m.channel_id) : s.dms[m.channel_id];
}

// Toque, contador no título e notificação do sistema para o que é da pessoa e não está na tela.
export function useMessageAlerts(openChannelId: string | undefined) {
  const { state, onGateway } = useStore();
  const visible = useDocumentVisible();
  const latest = useRef({ state, openChannelId });
  const lastCue = useRef(0);
  useEffect(() => {
    latest.current = { state, openChannelId };
  });

  useEffect(
    () =>
      onGateway((type, d) => {
        if (type !== "MESSAGE_CREATE") return;
        const m = d as unknown as ApiMessage;
        const { state: s, openChannelId: open } = latest.current;
        if (m.author.id === s.me?.id || !isMentioned(s, m)) return;
        if (m.channel_id === open && document.visibilityState === "visible") return;
        if (s.myStatus === "dnd" || s.myStatus === "invisible") return;

        const now = Date.now();
        if (now - lastCue.current > CUE_GAP_MS) {
          lastCue.current = now;
          playMessageCue();
        }
        const author = m.author.global_name || m.author.username;
        const place = m.guild_id ? ` · #${channelOf(s, m)?.name ?? "canal"}` : "";
        showNotification({
          title: `${author}${place}`,
          body: snippet(s, m),
          icon: m.author.avatar,
          // uma por conversa: a nova substitui a anterior
          tag: `message-${m.channel_id}`,
          data: { kind: "message", channelId: m.channel_id, guildId: m.guild_id },
        });
      }),
    [onGateway],
  );

  // voltar para a conversa tira a notificação dela da bandeja
  useEffect(() => {
    if (openChannelId && visible) closeNotification(`message-${openChannelId}`);
  }, [openChannelId, visible]);

  // "(3) Concord"
  const known = (id: string) => !!state.dms[id] || Object.values(state.guilds).some((g) => g.channels.some((c) => c.id === id));
  const unread = Object.values(state.readState).reduce((n, r) => (r.mention_count && known(r.id) && !(r.id === openChannelId && visible) ? n + r.mention_count : n), 0);
  useEffect(() => {
    document.title = unread ? `(${unread}) Concord` : "Concord";
  }, [unread]);

  // o navegador só libera som depois de um gesto na página
  useEffect(() => {
    const unlock = () => unlockAudio();
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);
}

const readInviteSeen = () => {
  try {
    return localStorage.getItem(INVITE_KEY) === "1";
  } catch {
    return true;
  }
};

// Convite discreto, uma vez só neste navegador. O pedido do navegador só sai ao clicar.
export function NotificationInvite() {
  const permission = useNotificationPermission();
  const [dismissed] = useState(readInviteSeen);
  const [closed, setClosed] = useState(false);
  const show = !dismissed && !closed && notificationsSupported() && permission === "default";

  useEffect(() => {
    if (!show) return;
    try {
      localStorage.setItem(INVITE_KEY, "1");
    } catch {}
  }, [show]);

  if (!show) return null;
  return (
    <div className="fixed bottom-3 right-3 z-[90] flex w-[calc(100vw-1.5rem)] max-w-xs items-start gap-2.5 rounded-2xl border border-line-strong bg-sheet p-3 text-ink shadow-pop" data-notify-invite>
      <Bell size={18} className="mt-0.5 shrink-0 text-signal-ink" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">Avisar quando chamarem você?</p>
        <p className="mt-0.5 text-xs text-muted">Mensagens e chamadas, com o Concord aberto em outra aba.</p>
        <button
          type="button"
          onClick={() => {
            setClosed(true);
            requestNotifications();
          }}
          className="mt-2 rounded-lg bg-signal px-3 py-1.5 text-xs font-semibold text-on-signal hover:brightness-110"
        >
          Ativar notificações
        </button>
      </div>
      <button type="button" aria-label="Agora não" onClick={() => setClosed(true)} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-paper-3 hover:text-ink">
        <X size={15} />
      </button>
    </div>
  );
}

export function NotificationSettings() {
  const permission = useNotificationPermission();
  return (
    <section className="pt-1" aria-label="Notificações">
      <h3 className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted">Notificações</h3>
      <p className="mb-2 mt-0.5 text-xs text-muted">Para mensagens diretas, menções e chamadas, com o Concord aberto. Não perturbe e invisível silenciam os avisos. Com o site fechado, nenhum aviso chega.</p>
      {permission === "default" && (
        <button type="button" onClick={requestNotifications} className="rounded-xl bg-signal px-4 py-2 text-sm font-semibold text-on-signal hover:brightness-110">
          Ativar notificações
        </button>
      )}
      {permission === "granted" && <p className="text-sm font-semibold text-online">Notificações ativadas neste navegador.</p>}
      {permission === "denied" && <p className="text-sm text-dnd">Bloqueadas no navegador. Para ativar, libere nas permissões do site, no ícone ao lado do endereço.</p>}
      {permission === "unsupported" && <p className="text-sm text-muted">Este navegador não tem notificações. No iPhone, instale o app na tela de início primeiro.</p>}
    </section>
  );
}
