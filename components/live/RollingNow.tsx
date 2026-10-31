"use client";

import { Gamepad2, Music, Play, Swords, Volume2, type LucideIcon } from "lucide-react";
import { brandOf, liveActivity, type Activity, type ActivityKind } from "@/lib/client/activity";
import { displayName, statusOf, useStore } from "@/lib/client/store";
import { Rel, canJoinVoice } from "@/lib/client/types";
import { useWide } from "@/lib/client/useWide";
import { BrandLogo } from "./BrandLogo";
import { STATUS_PT, UserAvatar } from "./ui";

// nome que não está na lista: o ícone genérico do que a pessoa disse que está fazendo
const KIND_ICON: Record<ActivityKind, LucideIcon> = { game: Gamepad2, watch: Play, listen: Music, compete: Swords };

export function ActivityTile({ activity }: { activity: Activity }) {
  const brand = brandOf(activity.name);
  if (brand && brand !== "game") return <BrandLogo brand={brand} />;
  const Icon = brand ? Gamepad2 : KIND_ICON[activity.kind];
  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-signal text-on-signal" aria-hidden>
      <Icon size={20} />
    </span>
  );
}

export function RollingNow({ onDm, onJoin }: { onDm: (userId: string) => void; onJoin: (channelId: string) => void }) {
  const { state } = useStore();
  const wide = useWide();
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
    <aside aria-labelledby="rolling-now" className="flex flex-col rounded-2xl bg-card-roll p-2.5 board:h-[342px]" data-rolling-card>
      <div className="px-1.5 py-2 board:h-[88px] board:shrink-0 board:px-2 board:pb-0 board:pt-[14px]">
        <h3 id="rolling-now" className="flex items-center gap-2 font-display text-xl font-extrabold board:gap-2.5 board:text-xl">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-online text-sheet" aria-hidden>
            <Play size={14} className="fill-current" />
          </span>
          Rolando agora
        </h3>
        <p className="mt-1 text-sm text-muted board:mt-1.5 board:text-[15px]">Veja o que seus amigos estão fazendo.</p>
      </div>

      {cards.length ? (
        <ul className="scroll-thin mt-2 space-y-[9px] board:mt-0 board:min-h-0 board:flex-1 board:overflow-y-auto">
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
                className="relative flex h-[68px] min-w-0 items-center gap-2.5 rounded-xl border border-line bg-card-item px-2.5 hover:border-line-strong board:gap-3 board:border-transparent board:pl-3.5 board:pr-[11px]"
              >
                {/* o botão cobre o cartão todo; o "Entrar" fica por cima dele, sem botão dentro de botão */}
                <button
                  type="button"
                  aria-label={`Abrir conversa com ${name}: ${line}`}
                  onClick={() => onDm(id)}
                  className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg text-left after:absolute after:inset-0 after:rounded-xl after:content-[''] board:gap-3"
                >
                  <UserAvatar user={user} size={wide ? 46 : 38} status={status} ring="border-card-item" />
                  <span className="min-w-0 flex-1 leading-tight">
                    <span className="block truncate text-sm font-semibold board:text-base">{name}</span>
                    <span className="mt-0.5 block truncate text-xs text-muted board:text-sm">{line}</span>
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
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-online text-sheet" aria-hidden>
                    <Volume2 size={20} />
                  </span>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="board:flex board:min-h-0 board:flex-1 board:items-center board:justify-center mt-2 rounded-xl border border-dashed board:mt-0 border-line-strong px-4 py-6 text-center text-sm text-muted">
          Quando seus amigos estiverem jogando ou em chamada, aparece aqui.
        </p>
      )}
    </aside>
  );
}
