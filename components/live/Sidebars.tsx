"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronDown,
  FolderPlus,
  Hash,
  LogOut,
  Megaphone,
  MessagesSquare,
  MoreVertical,
  Plus,
  Search,
  Settings,
  Trash2,
  UserPlus,
  Users,
  Volume2,
  X,
} from "lucide-react";
import { callStartedAt, displayName, dmName, isUnread, mentionCount, statusOf, useStore } from "@/lib/client/store";
import { Perm, hasPerm, type ApiChannel, type ApiGuild } from "@/lib/client/types";
import { personPrefs, useVoicePrefs } from "@/lib/client/voicePrefs";
import { canOpenGuildSettings } from "./GuildSettings";
import { CallTimer } from "./voice/CallTimer";
import { PersonControls } from "./voice/PersonControls";
import { UserAvatar } from "./ui";

const shell = "flex w-60 shrink-0 flex-col border-r border-line bg-paper-2 lg:w-64";

export function GuildSidebar({
  guild,
  channelId,
  voiceChannelId,
  onSelect,
  onVoice,
  onInvite,
  onCreateChannel,
  onLeave,
  onSettings,
  membersOpen,
  onToggleMembers,
  footer,
}: {
  guild: ApiGuild;
  channelId: string | null;
  voiceChannelId: string | null;
  onSelect: (id: string) => void;
  onVoice: (id: string) => void;
  onInvite: () => void;
  onCreateChannel: (parentId: string | null, type: 0 | 2 | 4) => void;
  onLeave: () => void;
  onSettings: () => void;
  membersOpen: boolean;
  onToggleMembers: () => void;
  footer: React.ReactNode;
}) {
  const { state, loadMembers } = useStore();
  const [closed, setClosed] = useState<Record<string, boolean>>({});
  const [menu, setMenu] = useState(false);
  const [voiceMenu, setVoiceMenu] = useState<string | null>(null);
  const prefs = useVoicePrefs();
  const canManage = hasPerm(guild.permissions, Perm.MANAGE_CHANNELS);
  const isOwner = guild.owner_id === state.me?.id;

  // online só com a lista carregada: enquanto isso a linha fica de fora, sem número inventado
  const members = state.members[guild.id];
  useEffect(() => {
    if (!members) loadMembers(guild.id).catch(() => {});
  }, [guild.id, members, loadMembers]);
  const online = members && Object.keys(members).filter((id) => statusOf(state, id) !== "offline").length;
  const partial = !!members && Object.keys(members).length < guild.member_count;

  const sorted = [...guild.channels].filter((c) => c.type !== 11).sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  // threads ficam embaixo do canal, mais novas primeiro
  const threadsOf = (parentId: string) =>
    guild.channels
      .filter((c) => c.type === 11 && c.parent_id === parentId)
      .sort((a, b) => (BigInt(b.last_message_id ?? b.id) > BigInt(a.last_message_id ?? a.id) ? 1 : -1))
      .slice(0, 8);
  const categories = sorted.filter((c) => c.type === 4);
  const loose = sorted.filter((c) => c.type !== 4 && !c.parent_id);
  const groups: { cat: ApiChannel | null; items: ApiChannel[] }[] = [
    ...(loose.length ? [{ cat: null, items: loose }] : []),
    ...categories.map((cat) => ({ cat, items: sorted.filter((c) => c.parent_id === cat.id && c.type !== 4) })),
  ];

  const menuItem = "flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-paper-2";

  return (
    <aside className={shell}>
      <div className="relative shrink-0">
        {guild.banner && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={guild.banner} alt="" className="h-24 w-full object-cover" data-guild-banner />
        )}
        <button
          onClick={() => setMenu((v) => !v)}
          aria-expanded={menu}
          className="flex w-full items-center justify-between gap-2 border-b border-line px-4 py-3 text-left hover:bg-paper-3/60"
        >
          <span className="min-w-0 leading-tight">
            <span className="block truncate font-display text-[15px] font-bold">{guild.name}</span>
            <span className="mt-0.5 block truncate text-xs text-muted">
              Comunidade • {guild.member_count} {guild.member_count === 1 ? "membro" : "membros"}
            </span>
            {online != null && (
              <span className="mt-0.5 flex items-center gap-1.5 text-xs text-muted">
                <span className="h-2 w-2 shrink-0 rounded-full bg-online" />
                {online}
                {partial && "+"} online
              </span>
            )}
          </span>
          {menu ? <X size={18} className="shrink-0" /> : <ChevronDown size={18} className="shrink-0" />}
        </button>
        <AnimatePresence>
          {menu && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="absolute left-2 right-2 top-full z-50 mt-1 rounded-xl border border-line-strong bg-sheet p-1.5 shadow-pop"
              onClick={() => setMenu(false)}
            >
              <button className={`${menuItem} text-signal-ink`} onClick={onInvite}>
                Convidar pessoas <UserPlus size={16} />
              </button>
              {canOpenGuildSettings(guild) && (
                <button className={menuItem} onClick={onSettings}>
                  Configurações do servidor <Settings size={16} />
                </button>
              )}
              {canManage && (
                <>
                  <button className={menuItem} onClick={() => onCreateChannel(null, 0)}>
                    Criar canal <Plus size={16} />
                  </button>
                  <button className={menuItem} onClick={() => onCreateChannel(null, 4)}>
                    Criar categoria <FolderPlus size={16} />
                  </button>
                </>
              )}
              <span className="my-1 block h-px bg-line" />
              <button className={`${menuItem} text-dnd hover:bg-dnd/10`} onClick={onLeave}>
                {isOwner ? "Excluir servidor" : "Sair do servidor"} {isOwner ? <Trash2 size={16} /> : <LogOut size={16} />}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="scroll-thin flex-1 overflow-y-auto px-2 pb-3 pt-2">
        <button
          onClick={onToggleMembers}
          aria-pressed={membersOpen}
          className="flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left text-[15px] text-muted hover:bg-paper-3/60 hover:text-ink"
        >
          <Users size={18} className="shrink-0 opacity-70" />
          Membros
        </button>
        <button onClick={onInvite} className="flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left text-[15px] text-muted hover:bg-paper-3/60 hover:text-ink">
          <UserPlus size={18} className="shrink-0 opacity-70" />
          Convidar pessoas
        </button>

        {groups.map(({ cat, items }) => {
          const key = cat?.id ?? "_";
          const isClosed = closed[key];
          return (
            <div key={key} className="mt-3">
              {cat && (
                <div className="group flex items-center justify-between px-1">
                  <button
                    onClick={() => setClosed((c) => ({ ...c, [key]: !c[key] }))}
                    className="flex min-w-0 items-center gap-0.5 text-[11px] font-bold uppercase tracking-[0.08em] text-muted hover:text-ink"
                  >
                    <ChevronDown size={12} className={`shrink-0 transition-transform ${isClosed ? "-rotate-90" : ""}`} />
                    <span className="truncate">{cat.name}</span>
                  </button>
                  {canManage && (
                    <button aria-label="Criar canal aqui" onClick={() => onCreateChannel(cat.id, 0)}>
                      <Plus size={15} className="text-muted hover:text-ink [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100" />
                    </button>
                  )}
                </div>
              )}
              <ul className="mt-1 space-y-px">
                {items
                  .filter((ch) => !isClosed || ch.id === channelId || isUnread(state, ch))
                  .map((ch) => {
                    const voice = ch.type === 2;
                    const active = !voice && ch.id === channelId;
                    const inCall = voice && ch.id === voiceChannelId;
                    const unread = !voice && isUnread(state, ch);
                    const mentions = mentionCount(state, ch.id);
                    const Icon = voice ? Volume2 : ch.type === 5 ? Megaphone : Hash;
                    const people = guild.voice_states.filter((v) => v.channel_id === ch.id);
                    return (
                      <li key={ch.id}>
                        <button
                          onClick={() => (voice ? onVoice(ch.id) : onSelect(ch.id))}
                          className={`relative flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-left text-[15px] ${
                            active
                              ? "glow bg-channel-active font-semibold text-ink"
                              : inCall
                                ? "font-semibold text-online hover:bg-paper-3/60"
                                : unread
                                ? "font-semibold text-ink hover:bg-paper-3/60"
                                : "text-muted hover:bg-paper-3/60 hover:text-ink"
                          }`}
                        >
                          {unread && !active && <span className="absolute -left-2 h-2 w-1 rounded-r bg-signal" />}
                          <Icon size={18} className="shrink-0 opacity-70" />
                          <span className="truncate">{ch.name}</span>
                          {voice && <CallTimer startedAt={callStartedAt(guild, ch.id)} className="ml-auto text-xs font-normal text-muted" />}
                          {!!mentions && !active && (
                            <span className="ml-auto rounded-full bg-signal px-1.5 text-[11px] font-bold tabular-nums text-on-signal">{mentions}</span>
                          )}
                        </button>
                        {people.length > 0 && (
                          <ul className="mb-1 ml-7 space-y-0.5">
                            {people.map((v) => {
                              const u = state.users[v.user_id];
                              return (
                                <li key={v.user_id}>
                                  <div className="group/person flex items-center gap-2 rounded px-1 py-0.5 text-sm text-muted">
                                    <UserAvatar user={u} size={22} />
                                    <span className="truncate">{displayName(u)}</span>
                                    {(v.mute || v.self_mute || v.self_deaf || personPrefs(prefs, v.user_id).muted) && (
                                      <span className="ml-auto shrink-0 text-[10px] text-dnd">
                                        {personPrefs(prefs, v.user_id).muted ? "silenciado" : v.mute ? "mod" : v.self_deaf ? "surdo" : "mudo"}
                                      </span>
                                    )}
                                    {v.user_id !== state.me?.id && (
                                      <button
                                        aria-label={`Opções de voz de ${displayName(u)}`}
                                        onClick={() => setVoiceMenu((m) => (m === v.user_id ? null : v.user_id))}
                                        className="shrink-0 rounded p-0.5 hover:text-ink [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover/person:opacity-100 focus:opacity-100"
                                      >
                                        <MoreVertical size={14} />
                                      </button>
                                    )}
                                  </div>
                                  {voiceMenu === v.user_id && <PersonControls identity={v.user_id} guildId={guild.id} onClose={() => setVoiceMenu(null)} />}
                                </li>
                              );
                            })}
                          </ul>
                        )}
                        {threadsOf(ch.id).length > 0 && (
                          <ul className="mb-1 ml-5 border-l border-line pl-2">
                            {threadsOf(ch.id).map((t) => {
                              const on = t.id === channelId;
                              return (
                                <li key={t.id}>
                                  <button
                                    onClick={() => onSelect(t.id)}
                                    className={`flex w-full items-center gap-1.5 rounded-lg px-2 py-1 text-left text-sm ${
                                      on ? "bg-channel-active font-semibold text-ink" : isUnread(state, t) ? "font-semibold text-ink hover:bg-paper-3/60" : "text-muted hover:bg-paper-3/60 hover:text-ink"
                                    }`}
                                  >
                                    <MessagesSquare size={14} className="shrink-0 opacity-70" />
                                    <span className="truncate">{t.name}</span>
                                  </button>
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </li>
                    );
                  })}
              </ul>
            </div>
          );
        })}

        {!guild.channels.length && <p className="mt-6 px-2 text-center text-sm text-muted">Nenhum canal por aqui ainda.</p>}
      </div>

      {footer}
    </aside>
  );
}

export function HomeSidebar({
  view,
  onFriends,
  onDm,
  onNewDm,
  footer,
}: {
  view: string | null; // id da DM aberta ou null = amigos
  onFriends: () => void;
  onDm: (id: string) => void;
  onNewDm: () => void;
  footer: React.ReactNode;
}) {
  const { state } = useStore();
  const [q, setQ] = useState("");
  const pending = Object.values(state.relationships).filter((r) => r.type === 3).length;
  const dms = Object.values(state.dms)
    .filter((c) => dmName(state, c).toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => (BigInt(b.last_message_id ?? b.id) > BigInt(a.last_message_id ?? a.id) ? 1 : -1));

  return (
    <aside className={shell}>
      <div className="flex h-12 shrink-0 items-center border-b border-line px-2.5">
        <label className="flex w-full items-center gap-2 rounded-lg bg-paper-3 px-2 py-1.5 text-sm text-muted">
          <Search size={14} />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Achar conversa"
            className="w-full bg-transparent outline-none placeholder:text-muted"
          />
        </label>
      </div>
      <div className="scroll-thin flex-1 overflow-y-auto px-2 pt-2">
        <button
          onClick={onFriends}
          className={`flex w-full items-center gap-3 rounded-lg px-2 py-2 text-[15px] font-semibold ${
            view === null ? "bg-paper-3 text-ink" : "text-muted hover:bg-paper-3/60 hover:text-ink"
          }`}
        >
          <Users size={20} />
          Amigos
          {!!pending && <span className="ml-auto rounded-full bg-signal px-1.5 text-[11px] font-bold tabular-nums text-on-signal">{pending}</span>}
        </button>

        <div className="mt-4 flex items-center justify-between px-2 text-[11px] font-bold uppercase tracking-[0.08em] text-muted">
          Mensagens diretas
          <button aria-label="Nova conversa" onClick={onNewDm} className="hover:text-ink">
            <Plus size={15} />
          </button>
        </div>
        <ul className="mt-1 space-y-px">
          {dms.map((c) => {
            const other = c.recipients?.[0];
            const u = other ? (state.users[other.id] ?? other) : undefined;
            const active = view === c.id;
            const mentions = mentionCount(state, c.id);
            const unread = isUnread(state, c);
            return (
              <li key={c.id}>
                <button
                  onClick={() => onDm(c.id)}
                  className={`flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left ${active ? "bg-paper-3" : "hover:bg-paper-3/60"}`}
                >
                  <UserAvatar
                    user={u}
                    size={32}
                    status={c.type === 1 && u ? statusOf(state, u.id) : undefined}
                    ring={active ? "border-paper-3" : "border-paper-2"}
                  />
                  <span className="min-w-0 flex-1 leading-tight">
                    <span className={`block truncate text-[15px] ${unread || active ? "font-semibold text-ink" : "text-ink-3"}`}>
                      {dmName(state, c)}
                    </span>
                    {c.type === 3 && <span className="block truncate text-xs text-muted">{(c.recipients?.length ?? 0) + 1} pessoas</span>}
                  </span>
                  {!!mentions && !active && (
                    <span className="rounded-full bg-signal px-1.5 text-[11px] font-bold tabular-nums text-on-signal">{mentions}</span>
                  )}
                </button>
              </li>
            );
          })}
          {!dms.length && <li className="px-2 py-4 text-center text-xs text-faint">Nenhuma conversa ainda.</li>}
        </ul>
      </div>
      {footer}
    </aside>
  );
}
