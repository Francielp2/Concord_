"use client";

import { Gamepad2, Music, Play, Swords, Volume2, type LucideIcon } from "lucide-react";
import { brandOf, liveActivity, type Activity, type ActivityKind, type Brand } from "@/lib/client/activity";
import { displayName, statusOf, useStore } from "@/lib/client/store";
import { Rel, canJoinVoice } from "@/lib/client/types";
import { STATUS_PT, UserAvatar } from "./ui";

const BRAND_TILE: Record<Brand, { Icon: LucideIcon; tone: string }> = {
  youtube: { Icon: Play, tone: "bg-brand-youtube text-on-brand" },
  spotify: { Icon: Music, tone: "bg-brand-spotify text-on-brand-light" },
  twitch: { Icon: Play, tone: "bg-brand-twitch text-on-brand" },
  netflix: { Icon: Play, tone: "bg-brand-netflix text-on-brand" },
  game: { Icon: Gamepad2, tone: "bg-signal text-on-signal" },
};

// nome que não está na lista: o ícone genérico do que a pessoa disse que está fazendo
const KIND_ICON: Record<ActivityKind, LucideIcon> = { game: Gamepad2, watch: Play, listen: Music, compete: Swords };

export function ActivityTile({ activity }: { activity: Activity }) {
  const brand = brandOf(activity.name);
  const { Icon, tone } = brand ? BRAND_TILE[brand] : { Icon: KIND_ICON[activity.kind], tone: "bg-signal text-on-signal" };
  return (
    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${tone}`} aria-hidden>
      <Icon size={18} />
    </span>
  );
}

export function RollingNow({ onDm, onJoin, className = "" }: { onDm: (userId: string) => void; onJoin: (channelId: string) => void; className?: string }) {
  const { state } = useStore();
  const myCall = state.me ? liveActivity(state, state.me.id).call : null;

  // invisível continua fora daqui mesmo em chamada: a presença é que decide quem aparece
  const cards = Object.values(state.relationships)
    .filter((r) => r.type === Rel.FRIEND && statusOf(state, r.id) !== "offline")
    .map((r) => {
      const user = state.users[r.id] ?? r.user;
      return { id: r.id, user, status: statusOf(state, r.id), live: liveActivity(state, r.id) };
    })
    .sort((a, b) => a.live.rank - b.live.rank || displayName(a.user).localeCompare(displayName(b.user)));

  return (
    <aside aria-labelledby="rolling-now" className={`bg-paper px-4 py-5 ${className}`}>
      <h3 id="rolling-now" className="flex items-center gap-2 font-display text-xl font-extrabold">
        <Play size={20} className="shrink-0 fill-online text-online" aria-hidden />
        Rolando agora
      </h3>
      <p className="mt-1 text-sm text-muted">Veja o que seus amigos estão fazendo.</p>

      {cards.length ? (
        <ul className="mt-4 space-y-2.5">
          {cards.map(({ id, user, status, live }) => {
            const name = displayName(user);
            const line = live.line ?? STATUS_PT[status];
            const channel = live.call?.channel;
            const canJoin =
              !!live.call && !!channel && live.call.channelId !== myCall?.channelId && canJoinVoice(live.call.guild, channel, state.me?.id);
            return (
              <li
                key={id}
                data-activity-card
                className="relative flex min-w-0 items-center gap-2.5 rounded-xl border border-line bg-sheet p-2.5 shadow-soft hover:border-line-strong motion-safe:transition-transform motion-safe:hover:-translate-y-0.5"
              >
                {/* o botão cobre o cartão todo; o "Entrar" fica por cima dele, sem botão dentro de botão */}
                <button
                  type="button"
                  aria-label={`Abrir conversa com ${name}: ${line}`}
                  onClick={() => onDm(id)}
                  className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg text-left after:absolute after:inset-0 after:rounded-xl after:content-['']"
                >
                  <UserAvatar user={user} size={38} status={status} ring="border-sheet" />
                  <span className="min-w-0 flex-1 leading-tight">
                    <span className="block truncate text-sm font-semibold">{name}</span>
                    <span className="mt-0.5 block truncate text-xs text-muted">{line}</span>
                  </span>
                </button>
                {canJoin && (
                  <button
                    type="button"
                    aria-label={`Entrar na chamada ${channel.name ?? ""} com ${name}`}
                    onClick={() => onJoin(live.call!.channelId)}
                    className="relative z-10 shrink-0 rounded-lg bg-online px-2.5 py-1.5 text-xs font-semibold text-sheet hover:brightness-110"
                  >
                    Entrar
                  </button>
                )}
                {live.activity ? (
                  <ActivityTile activity={live.activity} />
                ) : live.call ? (
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-online text-sheet" aria-hidden>
                    <Volume2 size={18} />
                  </span>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-6 rounded-xl border border-dashed border-line-strong px-4 py-6 text-center text-sm text-muted">
          Quando seus amigos estiverem jogando ou em chamada, aparece aqui.
        </p>
      )}
    </aside>
  );
}
