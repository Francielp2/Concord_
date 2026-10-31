"use client";

import { motion } from "framer-motion";
import { Plus } from "lucide-react";
import { LogoMark } from "@/components/Logo";
import { isUnread, mentionCount, useStore } from "@/lib/client/store";
import { colorFor, initialsOf } from "./ui";

function Item({
  active,
  label,
  pill,
  badge,
  onClick,
  children,
}: {
  active: boolean;
  label: string;
  pill?: boolean;
  badge?: number;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="group relative flex w-full justify-center">
      <motion.span
        className="absolute left-0 top-1/2 w-1 -translate-y-1/2 rounded-r bg-on-rail"
        initial={false}
        animate={{ height: active ? 36 : pill ? 8 : 0, opacity: active || pill ? 1 : 0 }}
        transition={{ type: "spring", stiffness: 500, damping: 32 }}
      />
      <button
        aria-label={label}
        title={label}
        onClick={onClick}
        className={`relative flex h-12 w-12 items-center justify-center rounded-[15px] duration-150 hover:scale-105 ${
          active ? "ring-2 ring-signal ring-offset-2 ring-offset-rail" : ""
        }`}
      >
        {children}
        {!!badge && (
          <span className="absolute -right-1 -bottom-1 flex h-5 min-w-5 items-center justify-center rounded-full border-[3px] border-rail bg-signal px-1 text-[10px] font-bold tabular-nums text-on-signal">
            {badge > 99 ? "99+" : badge}
          </span>
        )}
      </button>
    </div>
  );
}

export function Rail({ active, onSelect, onAdd }: { active: string; onSelect: (id: string) => void; onAdd: () => void }) {
  const { state } = useStore();
  const dmMentions = Object.values(state.dms).reduce((n, c) => n + mentionCount(state, c.id), 0);

  return (
    <nav className="scroll-ink flex w-[72px] shrink-0 flex-col items-center gap-2 overflow-y-auto bg-rail py-3">
      <Item active={active === "home"} label="Mensagens diretas" onClick={() => onSelect("home")} badge={dmMentions}>
        <span
          className={`flex h-full w-full items-center justify-center rounded-[inherit] transition-colors ${
            active === "home" ? "glow bg-signal" : "bg-rail-2 hover:bg-rail-3"
          }`}
        >
          <LogoMark size={28} stroke={active === "home" ? "var(--color-on-signal)" : "var(--color-on-rail)"} />
        </span>
      </Item>

      <span className="my-1 h-0.5 w-8 rounded bg-rail-3" />

      {state.guildOrder.map((id) => {
        const g = state.guilds[id];
        if (!g) return null;
        const text = g.channels.filter((c) => c.type === 0);
        const unread = text.some((c) => isUnread(state, c));
        const mentions = text.reduce((n, c) => n + mentionCount(state, c.id), 0);
        const color = colorFor(g.id);
        const on = active === g.id;
        return (
          <Item key={id} active={on} label={g.name} pill={unread} badge={mentions} onClick={() => onSelect(g.id)}>
            {g.icon ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={g.icon} alt="" className="h-full w-full rounded-[inherit] object-cover" />
            ) : (
              <span
                className="flex h-full w-full items-center justify-center rounded-[inherit] font-display text-[15px] font-bold"
                style={on ? { background: color, color: "var(--color-on-avatar)" } : { background: "var(--color-rail-2)", color: "var(--color-on-rail)" }}
              >
                {initialsOf(g.name)}
              </span>
            )}
          </Item>
        );
      })}

      <Item active={false} label="Criar ou entrar num servidor" onClick={onAdd}>
        <span className="flex h-full w-full items-center justify-center rounded-[inherit] bg-rail-2 text-on-rail transition-colors hover:bg-signal hover:text-on-signal">
          <Plus size={22} />
        </span>
      </Item>
    </nav>
  );
}
