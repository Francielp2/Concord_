"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Ban, Check, Loader2, Menu, MessageCircle, Search, UserMinus, Users, X } from "lucide-react";
import { api } from "@/lib/client/api";
import { displayName, statusOf, useStore } from "@/lib/client/store";
import { Rel, type ApiRelationship, type ApiUser } from "@/lib/client/types";
import { STATUS_PT, UserAvatar } from "./ui";

const TABS = [
  { id: "online", label: "Online" },
  { id: "all", label: "Todos" },
  { id: "pending", label: "Pendentes" },
  { id: "blocked", label: "Bloqueados" },
] as const;

type Tab = (typeof TABS)[number]["id"] | "add";

export function Friends({ onDm, onMenu }: { onDm: (userId: string) => void; onMenu: () => void }) {
  const { state } = useStore();
  const [tab, setTab] = useState<Tab>("online");
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
    <section className="flex min-w-0 flex-1 bg-sheet">
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex min-h-14 shrink-0 items-center gap-3 border-b border-line px-3">
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
                onClick={() => setTab(t.id)}
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
              onClick={() => setTab("add")}
              className={`whitespace-nowrap rounded-lg px-2.5 py-1 text-[15px] font-semibold ${
                tab === "add" ? "text-online" : "bg-online text-sheet hover:bg-online/90"
              }`}
            >
              Adicionar amigo
            </button>
          </nav>
        </header>

        <div className="scroll-thin flex-1 overflow-y-auto px-6 pt-4">
          {tab === "add" ? (
            <AddFriend />
          ) : (
            <>
              <label className="flex items-center gap-2 rounded-lg border border-line bg-paper px-3 py-1.5 focus-within:border-line-strong">
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar"
                  className="flex-1 bg-transparent text-[15px] outline-none placeholder:text-faint"
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
                <div className="flex flex-col items-center py-20 text-center">
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

      <aside className="hidden w-[340px] shrink-0 border-l border-line bg-paper px-4 pt-5 xl:block">
        <h3 className="font-display text-xl font-extrabold">Rolando agora</h3>
        <div className="mt-4 space-y-3">
          {friends
            .filter((r) => statusOf(state, r.id) !== "offline")
            .slice(0, 8)
            .map((r) => {
              const u = state.users[r.id] ?? r.user;
              const p = state.presences[r.id];
              return (
                <button
                  key={r.id}
                  onClick={() => onDm(r.id)}
                  className="flex w-full items-center gap-3 rounded-xl border border-line-strong bg-sheet p-3 text-left shadow-soft hover:-translate-y-0.5 transition-transform"
                >
                  <UserAvatar user={u} size={36} status={statusOf(state, r.id)} ring="border-sheet" />
                  <span className="min-w-0 leading-tight">
                    <span className="block truncate text-sm font-semibold">{displayName(u)}</span>
                    <span className="block truncate text-xs text-muted">{p?.custom_status || STATUS_PT[statusOf(state, r.id)]}</span>
                  </span>
                </button>
              );
            })}
        </div>
        <p className="mt-6 text-center text-xs text-faint">Quem estiver online aparece aqui.</p>
      </aside>
    </section>
  );
}

type Found = Pick<ApiUser, "id" | "username" | "global_name" | "avatar">;

const MIN_QUERY = 2;
const SEARCH_DEBOUNCE_MS = 250;

// Busca enquanto digita, e o pedido só sai ao clicar na pessoa: Enter não envia nada.
function AddFriend() {
  const { state } = useStore();
  const [text, setText] = useState("");
  const [result, setResult] = useState<{ q: string; items: Found[]; error: string } | null>(null);
  const [sent, setSent] = useState<string[]>([]);
  const [sending, setSending] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const q = text.trim().replace(/^@/, "");
  const searching = q.length >= MIN_QUERY;
  const loading = searching && result?.q !== q;

  useEffect(() => {
    if (!searching) return;
    let stale = false;
    const timer = setTimeout(async () => {
      try {
        const items = await api<Found[]>(`/users/search?q=${encodeURIComponent(q)}`);
        if (!stale) setResult({ q, items, error: "" });
      } catch (err) {
        if (!stale) setResult({ q, items: [], error: (err as Error).message });
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      stale = true;
      clearTimeout(timer);
    };
  }, [q, searching]);

  // a relação vem do estado ao vivo: aceitar ou cancelar em outra aba já reflete aqui
  function blockedReason(id: string) {
    const type = state.relationships[id]?.type;
    if (type === Rel.FRIEND) return "já é amigo";
    if (type === Rel.OUTGOING || sent.includes(id)) return "pedido enviado";
    if (type === Rel.INCOMING) return "pedido recebido";
    if (type === Rel.BLOCKED) return "bloqueado";
    return null;
  }

  async function send(u: Found) {
    setSending(u.id);
    setMsg(null);
    try {
      await api("/users/@me/relationships", { body: { username: u.username } });
      setSent((list) => [...list, u.id]);
      setMsg({ ok: true, text: `Pedido enviado pra ${u.global_name || u.username}.` });
    } catch (err) {
      setMsg({ ok: false, text: (err as Error).message });
    } finally {
      setSending(null);
    }
  }

  const shown = searching && !loading ? result : null;

  return (
    <div className="max-w-2xl pb-6">
      <h2 className="font-display text-xl font-bold">Adicionar amigo</h2>
      <p className="mt-1 text-sm text-muted">Procure pelo nome de usuário ou de exibição e escolha a pessoa na lista.</p>
      <label className="mt-4 flex items-center gap-2 rounded-2xl border border-line bg-paper px-3 py-2.5 shadow-soft focus-within:border-line-strong">
        <Search size={18} className="shrink-0 text-muted" />
        <input
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setMsg(null);
          }}
          placeholder="Comece a digitar um nome"
          aria-label="Buscar pessoas"
          autoComplete="off"
          maxLength={32}
          className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted md:text-[15px]"
        />
        {loading && <Loader2 size={16} className="shrink-0 animate-spin text-muted" aria-label="Buscando" />}
      </label>

      <div aria-live="polite">
        {text.trim() && !searching && <p className="mt-2 text-sm text-muted">Digite pelo menos {MIN_QUERY} letras.</p>}
        {loading && <p className="mt-2 text-sm text-muted">Buscando…</p>}
        {shown?.error && <p className="mt-2 text-sm text-dnd">{shown.error}</p>}
        {shown && !shown.error && !shown.items.length && <p className="mt-2 text-sm text-muted">Ninguém encontrado com esse começo de nome.</p>}
        {msg && <p className={`mt-2 text-sm ${msg.ok ? "text-online" : "text-dnd"}`}>{msg.text}</p>}
      </div>

      {!!shown?.items.length && (
        <ul className="mt-3 space-y-1">
          {shown.items.map((u) => {
            const reason = blockedReason(u.id);
            return (
              <li key={u.id}>
                <button
                  type="button"
                  disabled={!!reason || !!sending}
                  onClick={() => send(u)}
                  className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left enabled:hover:bg-paper-3/60 disabled:cursor-not-allowed"
                >
                  <UserAvatar user={{ ...u, bio: null }} size={36} />
                  <span className={`min-w-0 flex-1 leading-tight ${reason ? "opacity-70" : ""}`}>
                    <span className="block truncate font-semibold">{u.global_name || u.username}</span>
                    <span className="block truncate text-xs text-muted">@{u.username}</span>
                  </span>
                  {reason ? (
                    <span className="shrink-0 text-xs text-muted">{reason}</span>
                  ) : (
                    <span className="shrink-0 rounded-lg bg-signal px-2.5 py-1 text-xs font-semibold text-on-signal">
                      {sending === u.id ? "Enviando…" : "Enviar pedido"}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <p className="mt-6 text-sm text-muted">
        Seu usuário é <b className="font-mono text-ink">{state.me?.username}</b>. Passa pra galera te achar.
      </p>
    </div>
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
          : state.presences[r.id]?.custom_status || STATUS_PT[st];

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
