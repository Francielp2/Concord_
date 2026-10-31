"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Copy, Link2, Loader2, Search, UserPlus, X } from "lucide-react";
import { api } from "@/lib/client/api";
import { copyText } from "@/lib/client/clipboard";
import { displayName, useStore } from "@/lib/client/store";
import { Perm, Rel, channelHasPerm, type ApiInvite, type ApiUser } from "@/lib/client/types";
import { UserAvatar } from "./ui";

type Found = Pick<ApiUser, "id" | "username" | "global_name" | "avatar">;

const MIN_QUERY = 2;
const SEARCH_DEBOUNCE_MS = 250;
const SUGGESTION_LIMIT = 8;
const SUGGESTION_GUILDS = 3;
const INVITE_MAX_AGE = 604800; // igual ao modal de convite: o servidor reaproveita o mesmo código
const COPIED_MS = 1800;

const card = "rounded-2xl border border-line bg-paper p-4 shadow-soft";

export function AddFriendTab() {
  return (
    <div className="space-y-4 pb-6">
      <AddFriend />
      <Suggestions />
      <InviteCard />
    </div>
  );
}

function useCopied() {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  return [
    copied,
    () => {
      setCopied(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), COPIED_MS);
    },
  ] as const;
}

// Busca enquanto digita, escolhe na lista e só o botão envia: Enter não manda nada.
function AddFriend() {
  const { state } = useStore();
  const [text, setText] = useState("");
  const [result, setResult] = useState<{ q: string; items: Found[]; error: string } | null>(null);
  const [picked, setPicked] = useState<Found | null>(null);
  const [sent, setSent] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [copied, markCopied] = useCopied();
  const [copyFailed, setCopyFailed] = useState(false);

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

  async function send() {
    if (!picked) return;
    setSending(true);
    setMsg(null);
    try {
      await api("/users/@me/relationships", { body: { username: picked.username } });
      setSent((list) => [...list, picked.id]);
      setMsg({ ok: true, text: `Pedido enviado pra ${picked.global_name || picked.username}.` });
      setPicked(null);
    } catch (err) {
      setMsg({ ok: false, text: (err as Error).message });
    } finally {
      setSending(false);
    }
  }

  async function copyUsername() {
    const ok = await copyText(`@${state.me?.username}`);
    setCopyFailed(!ok);
    if (ok) markCopied();
  }

  const shown = searching && !loading ? result : null;
  const chosen = picked && !blockedReason(picked.id) ? picked : null;

  return (
    <div className={card}>
      <h2 className="font-display text-xl font-bold">Adicione amigo</h2>
      <p className="mt-1 text-sm text-muted">Procure pelo nome de usuário ou de exibição e escolha a pessoa na lista.</p>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <label className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-line bg-sheet px-3 py-2.5 focus-within:border-line-strong">
          <Search size={18} className="shrink-0 text-muted" />
          <input
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setPicked(null);
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
        <button
          type="button"
          disabled={!chosen || sending}
          onClick={send}
          className="shrink-0 rounded-xl bg-signal px-4 py-2.5 text-sm font-semibold text-on-signal enabled:hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {sending ? "Enviando…" : "Enviar pedido"}
        </button>
      </div>

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
            const on = picked?.id === u.id && !reason;
            return (
              <li key={u.id}>
                <button
                  type="button"
                  disabled={!!reason || sending}
                  aria-pressed={on}
                  onClick={() => setPicked(on ? null : u)}
                  className={`flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left disabled:cursor-not-allowed ${on ? "bg-channel-active" : "enabled:hover:bg-paper-3/60"}`}
                >
                  <UserAvatar user={{ ...u, bio: null }} size={36} />
                  <span className={`min-w-0 flex-1 leading-tight ${reason ? "opacity-70" : ""}`}>
                    <span className="block truncate font-semibold">{u.global_name || u.username}</span>
                    <span className="block truncate text-xs text-muted">@{u.username}</span>
                  </span>
                  {reason ? <span className="shrink-0 text-xs text-muted">{reason}</span> : on && <Check size={18} className="shrink-0 text-signal-ink" />}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <p className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-line pt-3 text-sm text-muted">
        <span className="min-w-0 break-words">
          Seu usuário é <b className="font-mono text-ink">@{state.me?.username}</b>. Passe para a galera te achar.
        </span>
        <button
          type="button"
          aria-label="Copiar meu usuário"
          title="Copiar meu usuário"
          onClick={copyUsername}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-line text-ink-3 hover:border-line-strong hover:text-ink"
        >
          {copied ? <Check size={15} className="text-online" /> : <Copy size={15} />}
        </button>
        {copyFailed && <span className="w-full text-xs text-dnd">Não deu para copiar. Copie o usuário acima à mão.</span>}
      </p>
    </div>
  );
}

function readList(key: string): string[] {
  try {
    const saved = JSON.parse(localStorage.getItem(key) ?? "[]");
    return Array.isArray(saved) ? saved.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

// Servidores em comum, com os membros dos 3 primeiros servidores (listas que o app já carrega ao abrir
// cada um). "Amigos em comum" exigiria ver a lista de amigos dos outros.
function Suggestions() {
  const { state, loadMembers } = useStore();
  const myId = state.me?.id;
  const dismissKey = `concord:suggestions-dismissed:${myId}`;
  const [dismissed, setDismissed] = useState(() => readList(dismissKey));
  const [sending, setSending] = useState<string | null>(null);
  const [error, setError] = useState("");

  const guildIds = useMemo(() => state.guildOrder.slice(0, SUGGESTION_GUILDS), [state.guildOrder]);
  const missing = guildIds.filter((id) => !state.members[id]);
  const missingKey = missing.join();
  useEffect(() => {
    if (missingKey) missingKey.split(",").forEach((id) => loadMembers(id).catch(() => {}));
  }, [missingKey, loadMembers]);

  const people = useMemo(() => {
    const common = new Map<string, { user: ApiUser; count: number }>();
    for (const id of guildIds) {
      for (const m of Object.values(state.members[id] ?? {})) {
        const u = m.user;
        if (!u || u.bot || u.id === myId || state.relationships[u.id] || dismissed.includes(u.id)) continue;
        common.set(u.id, { user: state.users[u.id] ?? u, count: (common.get(u.id)?.count ?? 0) + 1 });
      }
    }
    return [...common.values()]
      .sort((a, b) => b.count - a.count || displayName(a.user).localeCompare(displayName(b.user)))
      .slice(0, SUGGESTION_LIMIT);
  }, [guildIds, state.members, state.relationships, state.users, dismissed, myId]);

  function dismiss(id: string) {
    const next = [...dismissed, id];
    setDismissed(next);
    try {
      localStorage.setItem(dismissKey, JSON.stringify(next));
    } catch {}
  }

  async function add(user: ApiUser) {
    setSending(user.id);
    setError("");
    try {
      await api("/users/@me/relationships", { body: { username: user.username } });
      // o RELATIONSHIP_ADD já tira a pessoa da lista; isso só cobre o tempo até ele chegar
      setDismissed((list) => [...list, user.id]);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSending(null);
    }
  }

  if (!guildIds.length) return null;

  return (
    <section aria-labelledby="friend-suggestions" className={card}>
      <h2 id="friend-suggestions" className="font-display text-lg font-bold">
        Sugestões de amizade
      </h2>
      {error && <p className="mt-2 text-sm text-dnd">{error}</p>}
      {people.length ? (
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {people.map(({ user, count }) => {
            const name = displayName(user);
            return (
              <li key={user.id} data-suggestion className="flex min-w-0 items-center gap-2.5 rounded-xl border border-line bg-sheet p-2.5">
                <UserAvatar user={user} size={38} />
                <span className="min-w-0 flex-1 leading-tight">
                  <span className="block truncate text-sm font-semibold">{name}</span>
                  <span className="mt-0.5 block truncate text-xs text-muted">
                    {count} {count === 1 ? "servidor em comum" : "servidores em comum"}
                  </span>
                </span>
                <button
                  type="button"
                  aria-label={`Adicionar ${name}`}
                  disabled={!!sending}
                  onClick={() => add(user)}
                  className="flex h-8 shrink-0 items-center gap-1 rounded-lg bg-signal px-2 text-xs font-semibold text-on-signal enabled:hover:brightness-110 disabled:opacity-50"
                >
                  <UserPlus size={14} className="shrink-0" />
                  <span className="hidden min-[400px]:inline">{sending === user.id ? "Enviando…" : "Adicionar"}</span>
                </button>
                <button
                  type="button"
                  aria-label={`Dispensar sugestão de ${name}`}
                  onClick={() => dismiss(user.id)}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-paper-3 hover:text-ink"
                >
                  <X size={16} />
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-muted">{missing.length ? "Procurando gente dos seus servidores…" : "Sem sugestões por enquanto."}</p>
      )}
    </section>
  );
}

// abrir a aba de novo não gasta o limite de criação de convites
let cachedInvite: { guildId: string; guildName: string; link: string } | null = null;

function InviteCard() {
  const { state } = useStore();
  const myId = state.me?.id;
  const [invite, setInvite] = useState<{ link: string; note: string } | null>(() =>
    cachedInvite && state.guilds[cachedInvite.guildId] ? { link: cachedInvite.link, note: inviteNote(cachedInvite.guildName) } : null,
  );
  const [copied, markCopied] = useCopied();
  const [copyFailed, setCopyFailed] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const targets = useMemo(() => {
    const list: { guildId: string; guildName: string; channelId: string }[] = [];
    for (const id of state.guildOrder) {
      const guild = state.guilds[id];
      if (!guild) continue;
      const text = guild.channels.filter((c) => c.type === 0);
      const channel = text.find((c) => c.id === guild.system_channel_id && channelHasPerm(guild, c, myId, Perm.CREATE_INSTANT_INVITE)) ?? text.find((c) => channelHasPerm(guild, c, myId, Perm.CREATE_INSTANT_INVITE));
      if (channel) list.push({ guildId: id, guildName: guild.name, channelId: channel.id });
    }
    return list;
  }, [state.guildOrder, state.guilds, myId]);
  const first = targets[0];
  const hasInvite = !!invite;

  useEffect(() => {
    if (hasInvite) return;
    let stale = false;
    const fallback = () => ({ link: window.location.origin, note: "Endereço do Concord. Você ainda não pode convidar para nenhum servidor." });
    (async () => {
      if (!first) return setInvite(fallback());
      try {
        const inv = await api<ApiInvite>(`/channels/${first.channelId}/invites`, { body: { max_age: INVITE_MAX_AGE } });
        const link = `${window.location.origin}/invite/${inv.code}`;
        cachedInvite = { guildId: first.guildId, guildName: first.guildName, link };
        if (!stale) setInvite({ link, note: inviteNote(first.guildName) });
      } catch {
        if (!stale) setInvite(fallback());
      }
    })();
    return () => {
      stale = true;
    };
  }, [hasInvite, first]);

  async function copy() {
    if (!invite) return;
    const ok = await copyText(invite.link);
    setCopyFailed(!ok);
    if (ok) markCopied();
    else input.current?.select();
  }

  return (
    <section aria-labelledby="invite-friends" className={card}>
      <h2 id="invite-friends" className="flex items-center gap-2 font-display text-lg font-bold">
        <Link2 size={18} className="shrink-0 text-muted" aria-hidden />
        Convide seus amigos
      </h2>
      <p className="mt-1 text-sm text-muted">{invite?.note ?? "Preparando o link…"}</p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input
          ref={input}
          readOnly
          value={invite?.link ?? ""}
          aria-label="Link de convite"
          onFocus={(e) => e.target.select()}
          className="min-w-0 flex-1 rounded-xl border border-line bg-sheet px-3 py-2.5 font-mono text-sm outline-none focus:border-line-strong"
        />
        <button
          type="button"
          disabled={!invite}
          onClick={copy}
          className={`flex shrink-0 items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold disabled:opacity-50 ${copied ? "bg-online text-sheet" : "bg-signal text-on-signal hover:brightness-110"}`}
        >
          {copied ? <Check size={15} /> : <Copy size={15} />}
          {copied ? "Copiado" : "Copiar link"}
        </button>
      </div>
      {copyFailed && <p className="mt-2 text-sm text-dnd">O navegador não deixou copiar. O link está selecionado: use Ctrl+C.</p>}
    </section>
  );
}

function inviteNote(guildName: string) {
  return `Convite para o servidor ${guildName}. Vale por 7 dias.`;
}
