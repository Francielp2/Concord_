"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, Check, Copy, Link2, Loader2, Megaphone, Search, UserPlus, Users, X } from "lucide-react";
import { LogoMark } from "@/components/Logo";
import { api } from "@/lib/client/api";
import { copyText } from "@/lib/client/clipboard";
import { displayName, statusOf, useStore } from "@/lib/client/store";
import { useWide } from "@/lib/client/useWide";
import { Perm, Rel, channelHasPerm, type ApiChannel, type ApiInvite, type ApiUser } from "@/lib/client/types";
import { UserAvatar } from "./ui";

type Found = Pick<ApiUser, "id" | "username" | "global_name" | "avatar">;
type Suggestion = Found & { mutual_friends: number };

export const FRIEND_SEARCH_ID = "friend-search";

const MIN_QUERY = 2;
const SEARCH_DEBOUNCE_MS = 250;
const SUGGESTION_ROW = 4; // uma linha de cartões; dispensar um traz o próximo
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

  // a busca é só pelo nome: quem colar "deyvid#1234" acha o deyvid
  const q = text.trim().replace(/^@/, "").replace(/#.*$/, "");
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
      <div className="board:flex board:h-[100px] board:flex-col board:justify-end board:pb-5">
        <h2 className="flex items-center gap-2 font-display text-xl font-bold board:gap-3 board:text-[22px]">
          <Users size={22} className="shrink-0 fill-signal text-signal" aria-hidden />
          Adicione amigo
        </h2>
        <p className="mt-1 text-sm text-muted board:text-[15px]">Procure pelo nome de usuário ou tag (ex: deyvid#1234) e envie um pedido de amizade.</p>
      </div>
      <div className="relative">
      <div className="mt-4 flex flex-col gap-2 sm:flex-row board:mt-0 board:gap-3.5">
        <label className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-line-strong bg-field px-3 py-2.5 focus-within:border-signal board:h-[45px] board:py-0 board:pl-4">
          <Search size={18} className="shrink-0 text-muted" />
          <input
            id={FRIEND_SEARCH_ID}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setPicked(null);
              setMsg(null);
            }}
            placeholder="Comece a digitar um nome de usuário..."
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
          className="fill-signal-btn flex shrink-0 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-on-signal enabled:hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60 board:h-[45px] board:w-[169px] board:py-0 board:text-base"
        >
          <UserPlus size={18} className="shrink-0" aria-hidden />
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

      <p className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-line pt-3 text-sm text-muted board:mt-0 board:h-[62px] board:content-center board:border-b board:border-t-0 board:pb-1 board:pt-0 board:text-[15px]">
        <span className="min-w-0 break-words">
          Seu usuário é <b className="text-ink">{state.me?.username}.</b> Passe para a galera te achar.
        </span>
        <button
          type="button"
          aria-label="Copiar meu usuário"
          title="Copiar meu usuário"
          onClick={copyUsername}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-paper-3 hover:text-ink"
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

// A lista vem pronta do servidor: quem divide servidor primeiro, depois quem tem amigos em comum,
// e o resto completa. Os amigos em comum são contados lá, e a tela só recebe o número.
function Suggestions() {
  const { state } = useStore();
  const wide = useWide();
  const dismissKey = `concord:suggestions-dismissed:${state.me?.id}`;
  const [dismissed, setDismissed] = useState(() => readList(dismissKey));
  const [sending, setSending] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [pool, setPool] = useState<Suggestion[] | null>(null);
  const [limit, setLimit] = useState(SUGGESTION_ROW);

  useEffect(() => {
    api<Suggestion[]>("/users/search?suggest=1")
      .then(setPool)
      .catch(() => setPool([]));
  }, []);

  const free = (pool ?? []).filter((u) => !state.relationships[u.id] && !dismissed.includes(u.id));
  const people = free.slice(0, limit);

  function dismiss(id: string) {
    const next = [...dismissed, id];
    setDismissed(next);
    try {
      localStorage.setItem(dismissKey, JSON.stringify(next));
    } catch {}
  }

  async function add(user: Suggestion) {
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
      <div className="flex items-center gap-3 board:h-[81px] board:pl-[3px]">
        <Users size={wide ? 32 : 22} className="shrink-0 fill-signal text-signal" aria-hidden />
        <div className="min-w-0 flex-1 leading-tight">
          <h2 id="friend-suggestions" className="font-display text-lg font-bold">
            Sugestões de amizade
          </h2>
          <p className="mt-0.5 text-xs text-muted board:text-[13px]">Pessoas que você pode conhecer no Concord.</p>
        </div>
        {free.length > limit && (
          <button
            type="button"
            onClick={() => setLimit((n) => n + SUGGESTION_ROW)}
            className="flex shrink-0 items-center gap-1.5 rounded-lg text-sm font-medium text-ink-3 hover:text-ink"
          >
            Ver mais <ArrowRight size={16} aria-hidden />
          </button>
        )}
      </div>
      {error && <p className="mt-2 text-sm text-dnd">{error}</p>}
      {people.length ? (
        <ul className="mt-3 grid gap-2 sm:grid-cols-2 board:mt-0 board:grid-cols-4 board:gap-[17px]">
          {people.map((user) => {
            const person = { ...user, bio: null };
            const name = displayName(person);
            const status = statusOf(state, user.id);
            const count = user.mutual_friends;
            return (
              <li key={user.id} data-suggestion className="relative flex min-w-0 items-center gap-2.5 rounded-xl border border-card-suggest-line bg-card-suggest p-2.5 board:h-[195px] board:flex-col board:gap-2.5 board:rounded-[14px] board:px-5 board:pb-[51px] board:pt-[13px] board:text-center">
                <UserAvatar user={person} size={wide ? 64 : 38} status={status === "offline" ? undefined : status} ring="border-card-suggest" />
                <span className="min-w-0 flex-1 leading-tight board:w-full">
                  <span className="block truncate text-sm font-semibold board:text-base">{name}</span>
                  <span className="mt-0.5 block truncate text-xs text-muted board:mt-0 board:text-sm">
                    {count ? `${count} ${count === 1 ? "amigo em comum" : "amigos em comum"}` : `@${user.username}`}
                  </span>
                </span>
                <button
                  type="button"
                  aria-label={`Adicionar ${name}`}
                  disabled={!!sending}
                  onClick={() => add(user)}
                  className="flex h-8 shrink-0 items-center gap-1 rounded-lg bg-suggest-btn px-2 text-xs font-semibold text-on-signal enabled:hover:brightness-125 disabled:opacity-50 board:absolute board:bottom-[15px] board:left-5 board:right-[18px] board:h-9 board:justify-center board:gap-2 board:text-[15px]"
                >
                  <UserPlus size={wide ? 16 : 14} className="shrink-0" aria-hidden />
                  <span className="hidden min-[400px]:inline board:inline">{sending === user.id ? "Enviando…" : "Adicionar"}</span>
                </button>
                <button
                  type="button"
                  aria-label={`Dispensar sugestão de ${name}`}
                  onClick={() => dismiss(user.id)}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-paper-3 hover:text-ink board:absolute board:right-1 board:top-1"
                >
                  <X size={16} />
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-muted board:mt-0 board:flex board:h-[195px] board:items-center board:justify-center board:rounded-[14px] board:border board:border-card-suggest-line board:bg-card-suggest">{pool ? "Sem sugestões por enquanto." : "Procurando gente…"}</p>
      )}
    </section>
  );
}

// abrir a tela de novo não gasta o limite de criação de convites
let cachedInvite: { guildId: string; link: string } | null = null;

export function InviteCard() {
  const { state } = useStore();
  const myId = state.me?.id;
  const [link, setLink] = useState<string | null>(() => (cachedInvite && state.guilds[cachedInvite.guildId] ? cachedInvite.link : null));
  const [copied, markCopied] = useCopied();
  const [copyFailed, setCopyFailed] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  // primeiro servidor em que dá para convidar
  let channelId: string | undefined;
  let guildId: string | undefined;
  for (const id of state.guildOrder) {
    const guild = state.guilds[id];
    const text = guild?.channels.filter((c) => c.type === 0) ?? [];
    const can = (c: ApiChannel) => channelHasPerm(guild, c, myId, Perm.CREATE_INSTANT_INVITE);
    const channel = text.find((c) => c.id === guild?.system_channel_id && can(c)) ?? text.find(can);
    if (channel) {
      channelId = channel.id;
      guildId = id;
      break;
    }
  }
  const hasLink = !!link;

  useEffect(() => {
    if (hasLink) return;
    let stale = false;
    (async () => {
      if (!channelId || !guildId) return setLink(window.location.origin);
      try {
        const inv = await api<ApiInvite>(`/channels/${channelId}/invites`, { body: { max_age: INVITE_MAX_AGE } });
        const url = `${window.location.origin}/invite/${inv.code}`;
        cachedInvite = { guildId, link: url };
        if (!stale) setLink(url);
      } catch {
        if (!stale) setLink(window.location.origin);
      }
    })();
    return () => {
      stale = true;
    };
  }, [hasLink, channelId, guildId]);

  async function copy() {
    if (!link) return;
    const ok = await copyText(link);
    setCopyFailed(!ok);
    if (ok) markCopied();
    else input.current?.select();
  }

  return (
    <section aria-labelledby="invite-friends" className="relative overflow-hidden rounded-2xl bg-card-invite p-4 board:h-[438px] board:pb-0 board:pl-5 board:pr-[19px] board:pt-0" data-invite-card>
      {/* marca d'água: só decoração, sem atrapalhar o clique */}
      <span aria-hidden className="pointer-events-none absolute inset-0 hidden board:block" data-invite-art>
        <span className="absolute inset-x-0 bottom-0 h-1/2 bg-[radial-gradient(90%_70%_at_75%_100%,color-mix(in_srgb,var(--color-signal)_24%,transparent),transparent)]" />
        <svg viewBox="0 0 321 438" className="absolute inset-0 h-full w-full" fill="none" stroke="var(--color-signal)" strokeOpacity="0.6" strokeWidth="1.2" preserveAspectRatio="none">
          <path d="M321 244C262 256 232 298 226 344C220 396 198 420 158 414C120 408 80 412 51 438" />
          <path d="M321 334C270 332 214 356 186 396C176 410 170 424 166 438" />
        </svg>
        <LogoMark size={64} stroke="var(--color-signal)" className="absolute left-[128px] top-[312px] opacity-35" />
      </span>
      <div className="relative board:h-[116px] board:pt-5">
        <h2 id="invite-friends" className="flex items-center gap-2 font-display text-lg font-bold board:gap-2.5 board:text-[19px]">
          <Megaphone size={24} className="shrink-0 fill-signal text-signal" aria-hidden />
          Convide seus amigos
        </h2>
        <p className="mt-1 text-sm text-muted board:max-w-[260px] board:text-[15px] board:leading-5">Compartilhe o link e chame sua galera para o Concord.</p>
      </div>
      <div className="relative mt-3 flex flex-col gap-2 sm:flex-row board:mt-0 board:flex-col board:gap-[13px]">
        <div className="flex min-w-0 flex-1 overflow-hidden rounded-xl border border-line bg-card-item focus-within:border-line-strong board:h-11 board:flex-none">
          <input
            ref={input}
            readOnly
            value={link ?? ""}
            aria-label="Link de convite"
            title={channelId ? "Convite do seu primeiro servidor. Vale por 7 dias." : "Endereço do Concord: você ainda não pode convidar para nenhum servidor."}
            onFocus={(e) => e.target.select()}
            className="min-w-0 flex-1 bg-transparent px-3 py-2.5 text-sm text-ellipsis outline-none board:py-0 board:pl-3.5 board:text-[15px]"
          />
          <button
            type="button"
            disabled={!link}
            onClick={copy}
            aria-label="Copiar o link do campo"
            title="Copiar"
            className="flex w-11 shrink-0 items-center justify-center bg-copy-tile text-ink-3 hover:text-ink disabled:opacity-50"
          >
            {copied ? <Check size={18} className="text-online" /> : <Copy size={18} />}
          </button>
        </div>
        <button
          type="button"
          disabled={!link}
          onClick={copy}
          className={`flex shrink-0 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold disabled:opacity-50 board:h-[43px] board:py-0 board:text-base ${copied ? "bg-online text-sheet" : "fill-signal-btn text-on-signal hover:brightness-110"}`}
        >
          {copied ? <Check size={18} aria-hidden /> : <Link2 size={18} aria-hidden />}
          {copied ? "Copiado" : "Copiar link"}
        </button>
      </div>
      {copyFailed && <p className="relative mt-2 text-sm text-dnd">O navegador não deixou copiar. O link está selecionado: use Ctrl+C.</p>}
    </section>
  );
}
