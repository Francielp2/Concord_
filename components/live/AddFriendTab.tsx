"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Copy, Link2, Loader2, Search, UserPlus, X } from "lucide-react";
import { api } from "@/lib/client/api";
import { copyText } from "@/lib/client/clipboard";
import { displayName, useStore } from "@/lib/client/store";
import { useWide } from "@/lib/client/useWide";
import { Perm, Rel, channelHasPerm, type ApiInvite, type ApiUser } from "@/lib/client/types";
import { UserAvatar } from "./ui";

type Found = Pick<ApiUser, "id" | "username" | "global_name" | "avatar">;

const MIN_QUERY = 2;
const SEARCH_DEBOUNCE_MS = 250;
const SUGGESTION_LIMIT = 4; // uma linha de cartões; dispensar um traz o próximo
const SUGGESTION_GUILDS = 3;
const INVITE_MAX_AGE = 604800; // igual ao modal de convite: o servidor reaproveita o mesmo código
const COPIED_MS = 1800;

const card = "rounded-2xl border border-line bg-paper p-4 shadow-soft";
// no desktop as seções abrem direto no miolo, sem caixa em volta
const flat = "board:rounded-none board:border-0 board:bg-transparent board:p-0 board:shadow-none";

export function AddFriendTab() {
  return (
    <div className="space-y-4 pb-6 board:space-y-0 board:pb-[69px]">
      <AddFriend />
      <Suggestions />
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
    <div className={`${card} ${flat}`}>
      <div className="board:flex board:h-[100px] board:flex-col board:justify-end board:pb-3">
        <h2 className="font-display text-xl font-bold board:text-2xl">Adicione amigo</h2>
        <p className="mt-1 text-sm text-muted">Procure pelo nome de usuário ou de exibição e escolha a pessoa na lista.</p>
      </div>
      <div className="relative">
      <div className="mt-4 flex flex-col gap-2 sm:flex-row board:mt-0 board:gap-3.5">
        <label className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-line bg-field px-3 py-2.5 focus-within:border-line-strong board:h-[45px] board:py-0">
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
          className="shrink-0 rounded-xl bg-signal px-4 py-2.5 text-sm font-semibold text-on-signal enabled:hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50 board:h-[45px] board:w-[169px] board:py-0"
        >
          {sending ? "Enviando…" : "Enviar pedido"}
        </button>
      </div>

      {/* no desktop a lista abre por cima das sugestões, sem empurrar o resto da tela */}
      <div className={(text.trim() || msg) ? "board:absolute board:inset-x-0 board:top-[calc(100%+6px)] board:z-30 board:max-h-80 board:overflow-y-auto board:rounded-xl board:border board:border-line-strong board:bg-sheet board:p-2 board:shadow-pop" : ""}>
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
      </div>
      </div>

      <p className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-line pt-3 text-sm text-muted board:mt-0 board:h-[62px] board:content-center board:border-b board:border-t-0 board:pt-0">
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

// Primeiro quem divide servidor (membros dos 3 primeiros, listas que o app já carrega ao abrir cada um);
// se faltar, completa com outras pessoas do Concord. "Amigos em comum" exigiria ver a lista de amigos dos outros.
function Suggestions() {
  const { state, loadMembers } = useStore();
  const wide = useWide();
  const myId = state.me?.id;
  const dismissKey = `concord:suggestions-dismissed:${myId}`;
  const [dismissed, setDismissed] = useState(() => readList(dismissKey));
  const [sending, setSending] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [others, setOthers] = useState<Found[] | null>(null);

  const guildIds = useMemo(() => state.guildOrder.slice(0, SUGGESTION_GUILDS), [state.guildOrder]);
  const missing = guildIds.filter((id) => !state.members[id]);
  const missingKey = missing.join();
  useEffect(() => {
    if (missingKey) missingKey.split(",").forEach((id) => loadMembers(id).catch(() => {}));
  }, [missingKey, loadMembers]);

  const people = useMemo(() => {
    const common = new Map<string, { user: ApiUser; count: number }>();
    const free = (id: string) => id !== myId && !state.relationships[id] && !dismissed.includes(id);
    for (const id of guildIds) {
      for (const m of Object.values(state.members[id] ?? {})) {
        const u = m.user;
        if (!u || u.bot || !free(u.id)) continue;
        common.set(u.id, { user: state.users[u.id] ?? u, count: (common.get(u.id)?.count ?? 0) + 1 });
      }
    }
    const shared = [...common.values()].sort((a, b) => b.count - a.count || displayName(a.user).localeCompare(displayName(b.user)));
    // quem não divide servidor só completa a linha
    const rest = (others ?? []).filter((u) => free(u.id) && !common.has(u.id)).map((u) => ({ user: { ...u, bio: null }, count: 0 }));
    return [...shared, ...rest].slice(0, SUGGESTION_LIMIT);
  }, [guildIds, state.members, state.relationships, state.users, dismissed, myId, others]);

  const needOthers = !missing.length && others === null && people.length < SUGGESTION_LIMIT;
  useEffect(() => {
    if (!needOthers) return;
    api<Found[]>("/users/search?suggest=1")
      .then(setOthers)
      .catch(() => setOthers([]));
  }, [needOthers]);

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

  return (
    <section aria-labelledby="friend-suggestions" className={`${card} ${flat}`}>
      <h2 id="friend-suggestions" className="font-display text-lg font-bold board:flex board:h-[81px] board:items-end board:pb-3 board:text-xl">
        Sugestões de amizade
      </h2>
      {error && <p className="mt-2 text-sm text-dnd">{error}</p>}
      {people.length ? (
        <ul className="mt-3 grid gap-2 sm:grid-cols-2 board:mt-0 board:grid-cols-4 board:gap-[17px]">
          {people.map(({ user, count }) => {
            const name = displayName(user);
            return (
              <li key={user.id} data-suggestion className="relative flex min-w-0 items-center gap-2.5 rounded-xl border border-card-suggest-line bg-card-suggest p-2.5 board:h-[195px] board:flex-col board:gap-2 board:rounded-[14px] board:px-3.5 board:pb-[51px] board:pt-5 board:text-center">
                <UserAvatar user={user} size={wide ? 56 : 38} />
                <span className="min-w-0 flex-1 leading-tight board:w-full">
                  <span className="block truncate text-sm font-semibold">{name}</span>
                  <span className="mt-0.5 block truncate text-xs text-muted board:whitespace-normal">
                    {!count ? `@${user.username}` : `${count} ${count === 1 ? "servidor em comum" : "servidores em comum"}`}
                  </span>
                </span>
                <button
                  type="button"
                  aria-label={`Adicionar ${name}`}
                  disabled={!!sending}
                  onClick={() => add(user)}
                  className="flex h-8 shrink-0 items-center gap-1 rounded-lg bg-signal px-2 text-xs font-semibold text-on-signal enabled:hover:brightness-110 disabled:opacity-50 board:absolute board:inset-x-3.5 board:bottom-[15px] board:h-[35px] board:justify-center board:text-sm"
                >
                  <UserPlus size={14} className="shrink-0" />
                  <span className="hidden min-[400px]:inline board:inline">{sending === user.id ? "Enviando…" : "Adicionar"}</span>
                </button>
                <button
                  type="button"
                  aria-label={`Dispensar sugestão de ${name}`}
                  onClick={() => dismiss(user.id)}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-paper-3 hover:text-ink board:absolute board:right-1.5 board:top-1.5"
                >
                  <X size={16} />
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-muted board:mt-0 board:flex board:h-[195px] board:items-center board:justify-center board:rounded-[14px] board:border board:border-card-suggest-line board:bg-card-suggest">{missing.length || needOthers ? "Procurando gente…" : "Sem sugestões por enquanto."}</p>
      )}
    </section>
  );
}

// abrir a aba de novo não gasta o limite de criação de convites
let cachedInvite: { guildId: string; guildName: string; link: string } | null = null;

export function InviteCard() {
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
    <section aria-labelledby="invite-friends" className="rounded-2xl bg-card-invite p-4 board:h-[438px] board:pb-0 board:pl-5 board:pr-[19px] board:pt-0" data-invite-card>
      <div className="board:h-[116px] board:pt-5">
        <h2 id="invite-friends" className="flex items-center gap-2 font-display text-lg font-bold">
          <Link2 size={18} className="shrink-0 text-muted" aria-hidden />
          Convide seus amigos
        </h2>
        <p className="mt-1 text-sm text-muted">{invite?.note ?? "Preparando o link…"}</p>
      </div>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row board:mt-0 board:flex-col board:gap-[13px]">
        <input
          ref={input}
          readOnly
          value={invite?.link ?? ""}
          aria-label="Link de convite"
          onFocus={(e) => e.target.select()}
          className="min-w-0 flex-1 rounded-xl border border-line bg-card-item px-3 py-2.5 font-mono text-sm outline-none focus:border-line-strong board:h-11 board:flex-none board:py-0"
        />
        <button
          type="button"
          disabled={!invite}
          onClick={copy}
          className={`flex shrink-0 items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold disabled:opacity-50 board:h-[43px] board:py-0 ${copied ? "bg-online text-sheet" : "bg-signal text-on-signal hover:brightness-110"}`}
        >
          {copied ? <Check size={15} /> : <Copy size={15} />}
          {copied ? "Copiado" : "Copiar link"}
        </button>
      </div>
      {copyFailed && <p className="mt-2 text-sm text-dnd">O navegador não deixou copiar. O link está selecionado: use Ctrl+C.</p>}
      <ol className="mt-5 hidden space-y-3 text-sm text-ink-3 board:block">
        {["Copie o link", "Mande para a galera", "Quem abrir já entra no servidor"].map((step, i) => (
          <li key={step} className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-card-item text-xs font-bold text-signal-ink">{i + 1}</span>
            {step}
          </li>
        ))}
      </ol>
    </section>
  );
}

function inviteNote(guildName: string) {
  return `Convite para o servidor ${guildName}. Vale por 7 dias.`;
}
