"use client";

import { useMemo, useRef, useState } from "react";
import { Hash, MessageCircle, Search, Server, User, Volume2, type LucideIcon } from "lucide-react";
import { displayName, dmName, useStore } from "@/lib/client/store";
import { Rel } from "@/lib/client/types";

export type PaletteTarget =
  | { kind: "guild"; id: string }
  | { kind: "channel"; id: string; guildId: string }
  | { kind: "dm"; id: string }
  | { kind: "friend"; id: string };

type Item = { key: string; label: string; hint: string; group: string; Icon: LucideIcon; target: PaletteTarget };

const MAX_RESULTS = 30;
const EMPTY_RESULTS = 8;

const fold = (text: string) => text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

// Só pesquisa o que já está carregado: nenhuma rota nova.
export function CommandPalette({ open, onClose, onPick }: { open: boolean; onClose: () => void; onPick: (target: PaletteTarget) => void }) {
  if (!open) return null;
  return <PaletteBody onClose={onClose} onPick={onPick} />;
}

function PaletteBody({ onClose, onPick }: { onClose: () => void; onPick: (target: PaletteTarget) => void }) {
  const { state } = useStore();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [returnTo] = useState(() => document.activeElement as HTMLElement | null);
  const list = useRef<HTMLUListElement>(null);

  const all = useMemo(() => {
    const items: Item[] = [];
    for (const id of state.guildOrder) {
      const g = state.guilds[id];
      if (!g) continue;
      items.push({ key: `g${id}`, label: g.name, hint: "Servidor", group: "Servidores", Icon: Server, target: { kind: "guild", id } });
      for (const c of g.channels) {
        if (c.type !== 0 && c.type !== 2 && c.type !== 5) continue;
        // canal de voz abre o servidor: entrar numa chamada é um clique de propósito, não um Enter de busca
        items.push({
          key: `c${c.id}`,
          label: c.name ?? "",
          hint: g.name,
          group: "Canais",
          Icon: c.type === 2 ? Volume2 : Hash,
          target: c.type === 2 ? { kind: "guild", id } : { kind: "channel", id: c.id, guildId: id },
        });
      }
    }
    for (const c of Object.values(state.dms)) {
      items.push({ key: `d${c.id}`, label: dmName(state, c), hint: "Conversa", group: "Conversas", Icon: MessageCircle, target: { kind: "dm", id: c.id } });
    }
    for (const r of Object.values(state.relationships)) {
      if (r.type !== Rel.FRIEND) continue;
      const u = state.users[r.id] ?? r.user;
      items.push({ key: `f${r.id}`, label: displayName(u), hint: `@${u.username}`, group: "Amigos", Icon: User, target: { kind: "friend", id: r.id } });
    }
    return items;
  }, [state]);

  const results = useMemo(() => {
    const q = fold(query.trim());
    if (!q) return all.filter((i) => i.group === "Conversas" || i.group === "Servidores").slice(0, EMPTY_RESULTS);
    const score = (i: Item) => {
      const label = fold(i.label);
      if (label.startsWith(q)) return 0;
      if (label.includes(q)) return 1;
      return fold(i.hint).includes(q) ? 2 : 3;
    };
    return all
      .map((item, order) => ({ item, order, s: score(item) }))
      .filter((x) => x.s < 3)
      .sort((a, b) => a.s - b.s || a.order - b.order)
      .slice(0, MAX_RESULTS)
      .map((x) => x.item);
  }, [all, query]);

  const index = Math.min(active, Math.max(0, results.length - 1));

  function close() {
    onClose();
    returnTo?.focus?.();
  }

  function move(delta: number) {
    if (!results.length) return;
    const next = (index + delta + results.length) % results.length;
    setActive(next);
    list.current?.children[next]?.scrollIntoView({ block: "nearest" });
  }

  function pick(item: Item | undefined) {
    if (!item) return;
    onClose();
    onPick(item.target);
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      move(1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      move(-1);
    } else if (e.key === "Enter") {
      e.preventDefault();
      pick(results[index]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      close();
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center bg-scrim/60 p-3 pt-[10dvh] text-ink"
      onMouseDown={(e) => e.target === e.currentTarget && close()}
      data-command-palette
    >
      <div role="dialog" aria-modal aria-label="Buscar no Concord" className="flex max-h-[70dvh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-line bg-sheet shadow-pop">
        <label className="flex shrink-0 items-center gap-2 border-b border-line px-3 py-2.5">
          <Search size={18} className="shrink-0 text-muted" aria-hidden />
          <input
            autoFocus
            role="combobox"
            aria-expanded
            aria-controls="palette-results"
            aria-activedescendant={results[index] ? `palette-${results[index].key}` : undefined}
            aria-label="Buscar servidores, canais, conversas e amigos"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={onKey}
            placeholder="Buscar no Concord"
            className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted md:text-[15px]"
          />
        </label>
        <ul ref={list} id="palette-results" role="listbox" aria-label="Resultados" className="scroll-thin min-h-0 flex-1 overflow-y-auto p-1.5">
          {results.map((item, i) => (
            <li
              key={item.key}
              id={`palette-${item.key}`}
              role="option"
              aria-selected={i === index}
              onMouseEnter={() => setActive(i)}
              onClick={() => pick(item)}
              className={`flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-2 text-sm ${i === index ? "bg-channel-active" : ""}`}
            >
              <item.Icon size={16} className="shrink-0 text-muted" aria-hidden />
              <span className="min-w-0 flex-1 truncate font-medium">{item.label}</span>
              <span className="max-w-[45%] shrink-0 truncate text-xs text-muted">{item.hint}</span>
            </li>
          ))}
          {!results.length && <li className="px-2 py-6 text-center text-sm text-muted">Nada encontrado.</li>}
        </ul>
      </div>
    </div>
  );
}
