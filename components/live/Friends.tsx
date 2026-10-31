"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Ban, Check, Menu, MessageCircle, Search, UserMinus, Users, X } from "lucide-react";
import { liveActivity } from "@/lib/client/activity";
import { api } from "@/lib/client/api";
import { displayName, statusOf, useStore } from "@/lib/client/store";
import { Rel, type ApiRelationship } from "@/lib/client/types";
import { AddFriendTab, InviteCard } from "./AddFriendTab";
import { FriendsBanner } from "./FriendsBanner";
import { RollingNow } from "./RollingNow";
import { STATUS_PT, UserAvatar } from "./ui";

const TABS = [
  { id: "online", label: "Online" },
  { id: "all", label: "Todos" },
  { id: "pending", label: "Pendentes" },
  { id: "blocked", label: "Bloqueados" },
] as const;

export type FriendsTab = (typeof TABS)[number]["id"] | "add";

export function Friends({
  tab,
  onTab,
  onDm,
  onJoin,
  onMenu,
}: {
  tab: FriendsTab;
  onTab: (tab: FriendsTab) => void;
  onDm: (userId: string) => void;
  onJoin: (channelId: string) => void;
  onMenu: () => void;
}) {
  const { state } = useStore();
  const [query, setQuery] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const rels = Object.values(state.relationships);
  const friends = rels.filter((r) => r.type === Rel.FRIEND);
  const pending = rels.filter((r) => r.type === Rel.INCOMING || r.type === Rel.OUTGOING);
  const blocked = rels.filter((r) => r.type === Rel.BLOCKED);
  const incoming = pending.filter((r) => r.type === Rel.INCOMING).length;

  const shown = (tab === "online" ? friends.filter((r) => statusOf(state, r.id) !== "offline") : tab === "all" ? friends : tab === "pending" ? pending : blocked)
    .filter((r) => {
      const u = state.users[r.id] ?? r.user;
      return `${displayName(u)} ${u.username}`.toLowerCase().includes(query.toLowerCase());
    })
    .sort((a, b) => displayName(a.user).localeCompare(displayName(b.user)));

  async function act(path: string, method: "PUT" | "DELETE", body?: Record<string, unknown>) {
    await api(`/users/@me/relationships/${path}`, { method, body }).catch((e) => setMsg({ ok: false, text: e.message }));
  }

  const heading =
    tab === "online" ? "Online" : tab === "all" ? "Todos os amigos" : tab === "pending" ? "Pendentes" : "Bloqueados";

  return (
    // abaixo de xl rola tudo junto e a coluna direita vira uma seção no fim; em xl cada coluna rola sozinha
    <section className="scroll-thin flex min-w-0 flex-1 flex-col overflow-y-auto bg-sheet xl:flex-row xl:overflow-hidden">
      <div className="shrink-0 xl:flex xl:min-w-0 xl:flex-1 xl:shrink xl:flex-col">
      <header className="sticky top-0 z-10 flex min-h-14 shrink-0 items-center gap-3 border-b border-line bg-sheet px-3 xl:relative xl:h-[65px] xl:min-h-[65px]">
          <button
            className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-3 hover:bg-paper-2 md:hidden"
            aria-label="Abrir menu"
            onClick={onMenu}
          >
            <Menu size={20} />
          </button>
          <span className="flex items-center gap-2 font-display font-bold">
            <Users size={20} className="text-muted" />
            Amigos
          </span>
          <span className="h-5 w-px bg-line" />
          <nav className="scroll-ink flex items-center gap-1 overflow-x-auto" role="tablist">
            {TABS.map((t) => (
              <button
                key={t.id}
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => onTab(t.id)}
                className={`relative whitespace-nowrap rounded-lg px-2.5 py-1 text-[15px] font-medium ${
                  tab === t.id ? "text-ink" : "text-muted hover:bg-paper-2 hover:text-ink"
                }`}
              >
                {tab === t.id && (
                  <motion.span
                    layoutId="live-friends-tab"
                    className="absolute inset-0 rounded-lg bg-paper-2"
                    transition={{ type: "spring", stiffness: 500, damping: 36 }}
                  />
                )}
                <span className="relative">
                  {t.label}
                  {t.id === "pending" && !!incoming && (
                    <span className="ml-1.5 rounded-full bg-signal px-1.5 text-[11px] font-bold tabular-nums text-on-signal">{incoming}</span>
                  )}
                </span>
              </button>
            ))}
            <button
              onClick={() => onTab("add")}
              className={`whitespace-nowrap rounded-lg bg-add-friend px-2.5 py-1 text-[15px] font-semibold text-on-add-friend hover:brightness-110 xl:h-[38px] xl:rounded-xl xl:px-4 2xl:absolute 2xl:left-[573px] 2xl:top-4 2xl:w-[181px] ${
                tab === "add" ? "ring-2 ring-inset ring-signal-ink" : ""
              }`}
            >
              Adicionar amigo
            </button>
          </nav>
        </header>

        <div className="scroll-thin min-w-0 px-3 pt-3 sm:px-6 sm:pt-4 xl:min-h-0 xl:flex-1 xl:overflow-y-auto xl:pl-[29px] xl:pr-[25px] xl:pt-5">
          <FriendsBanner />
          <div className={tab === "add" ? "mt-4 xl:mt-0" : "mt-4"}>
            {tab === "add" ? (
              <AddFriendTab />
            ) : (
              <>
                <label className="flex items-center gap-2 rounded-lg border border-line bg-paper px-3 py-1.5 focus-within:border-line-strong">
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Buscar"
                    aria-label="Buscar nos amigos"
                    className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-faint"
                  />
                  <Search size={16} className="text-muted" />
                </label>

                <h3 className="mb-2 mt-5 text-[11px] font-bold uppercase tracking-[0.08em] text-muted">
                  {heading} · {shown.length}
                </h3>

                {msg && !msg.ok && <p className="mb-2 text-sm text-dnd">{msg.text}</p>}

                {shown.map((r) => (
                  <FriendRow key={r.id} r={r} onDm={() => onDm(r.id)} act={act} />
                ))}

                {!shown.length && (
                  <div className="flex flex-col items-center py-12 text-center">
                    <span className="font-display text-3xl font-bold text-muted">
                      {tab === "online" ? "Tudo quieto." : tab === "blocked" ? "Ninguém aqui." : tab === "pending" ? "Nada pendente." : "Bora fazer amigos?"}
                    </span>
                    <p className="mt-2 text-sm text-muted">
                      {tab === "online" || tab === "all" ? "Manda um pedido na aba Adicionar amigo." : ""}
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

      </div>

        <div className="scroll-thin mt-4 shrink-0 space-y-4 border-t border-line bg-shell-right p-3 sm:p-6 xl:mt-0 xl:w-[300px] xl:shrink-0 xl:space-y-6 xl:overflow-y-auto xl:border-l xl:border-t-0 xl:border-shell-right-line xl:pb-6 xl:pl-[13px] xl:pr-4 xl:pt-4 2xl:w-[351px]">
          <RollingNow onDm={onDm} onJoin={onJoin} />
          <InviteCard />
        </div>
    </section>
  );
}

function FriendRow({
  r,
  onDm,
  act,
}: {
  r: ApiRelationship;
  onDm: () => void;
  act: (path: string, method: "PUT" | "DELETE", body?: Record<string, unknown>) => Promise<void>;
}) {
  const { state } = useStore();
  const u = state.users[r.id] ?? r.user;
  const st = statusOf(state, r.id);
  const sub =
    r.type === Rel.INCOMING
      ? "Quer ser seu amigo"
      : r.type === Rel.OUTGOING
        ? "Pedido enviado"
        : r.type === Rel.BLOCKED
          ? "Bloqueado"
          : liveActivity(state, r.id).line || STATUS_PT[st];

  return (
    <div
      onClick={r.type === Rel.FRIEND ? onDm : undefined}
      className={`group -mx-2 flex items-center gap-3 rounded-xl border-t border-line px-2 py-2.5 hover:border-transparent hover:bg-paper ${
        r.type === Rel.FRIEND ? "cursor-pointer" : ""
      }`}
    >
      <UserAvatar user={u} size={34} status={r.type === Rel.FRIEND ? st : undefined} ring="border-sheet" />
      <div className="min-w-0 flex-1 leading-tight">
        <p className="truncate font-semibold">
          {displayName(u)} <span className="hidden font-mono text-xs font-normal text-muted group-hover:inline">@{u.username}</span>
        </p>
        <p className="truncate text-xs text-muted">{sub}</p>
      </div>
      <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
        {r.type === Rel.FRIEND && (
          <>
            <Round label="Mandar mensagem" onClick={onDm}>
              <MessageCircle size={18} />
            </Round>
            <Round label="Desfazer amizade" tone="dnd" onClick={() => act(r.id, "DELETE")}>
              <UserMinus size={18} />
            </Round>
            <Round label="Bloquear" tone="dnd" onClick={() => act(r.id, "PUT", { type: 2 })}>
              <Ban size={17} />
            </Round>
          </>
        )}
        {r.type === Rel.INCOMING && (
          <Round label="Aceitar" tone="online" onClick={() => act(r.id, "PUT", {})}>
            <Check size={18} />
          </Round>
        )}
        {r.type !== Rel.FRIEND && (
          <Round
            label={r.type === Rel.INCOMING ? "Recusar" : r.type === Rel.BLOCKED ? "Desbloquear" : "Cancelar"}
            tone="dnd"
            onClick={() => act(r.id, "DELETE")}
          >
            <X size={18} />
          </Round>
        )}
      </div>
    </div>
  );
}

function Round({
  label,
  children,
  onClick,
  tone,
}: {
  label: string;
  children: React.ReactNode;
  onClick?: () => void;
  tone?: "online" | "dnd";
}) {
  const hover = tone === "online" ? "hover:text-online" : tone === "dnd" ? "hover:text-dnd" : "hover:text-ink";
  return (
    <button
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`flex h-9 w-9 items-center justify-center rounded-full border border-line bg-paper-2 text-ink-3 ${hover}`}
    >
      {children}
    </button>
  );
}
