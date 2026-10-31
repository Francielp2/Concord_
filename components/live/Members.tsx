"use client";

import { useEffect } from "react";
import { Crown } from "lucide-react";
import { customStatusText } from "@/lib/client/activity";
import { displayName, statusOf, useStore } from "@/lib/client/store";
import type { ApiGuild, ApiMember } from "@/lib/client/types";
import { STATUS_PT, UserAvatar } from "./ui";

export function Members({ guild, onDm, className }: { guild: ApiGuild; onDm: (userId: string) => void; className: string }) {
  const { state, loadMembers } = useStore();
  const members = state.members[guild.id];

  useEffect(() => {
    if (!members) loadMembers(guild.id).catch(() => {});
  }, [guild.id, members, loadMembers]);

  const list = Object.values(members ?? {});
  const hoisted = [...guild.roles].filter((r) => r.hoist && r.id !== guild.id).sort((a, b) => b.position - a.position);

  // cada pessoa fica no cargo em destaque (hoist) mais alto que tiver; sem nenhum, em "Membros"
  const groups: { title: string; items: ApiMember[] }[] = hoisted.map((role) => ({ title: role.name, items: [] }));
  const others: ApiMember[] = [];
  for (const m of list) {
    const i = hoisted.findIndex((r) => m.roles.includes(r.id));
    (i === -1 ? others : groups[i].items).push(m);
  }
  groups.push({ title: "Membros", items: others });
  const offline = (m: ApiMember) => (statusOf(state, m.user!.id) === "offline" ? 1 : 0);

  return (
    <aside className={`scroll-thin w-60 shrink-0 overflow-y-auto border-l border-line bg-paper-2 lg:w-64 px-2 pb-4 ${className}`}>
      {!members && <p className="px-2 pt-5 text-sm text-muted">Carregando membros…</p>}
      {groups
        .filter((g) => g.items.length)
        .map((g) => (
          <div key={g.title}>
            <h3 className="px-2 pb-1 pt-5 text-[11px] font-bold uppercase tracking-[0.08em] text-muted">
              {g.title} — {g.items.length}
            </h3>
            <ul>
              {g.items
                .sort((a, b) => offline(a) - offline(b) || displayName(state.users[a.user!.id]).localeCompare(displayName(state.users[b.user!.id])))
                .map((m) => {
                  const u = state.users[m.user!.id] ?? m.user!;
                  const st = statusOf(state, u.id);
                  const custom = customStatusText(state.presences[u.id]?.custom_status);
                  const top = guild.roles
                    .filter((r) => m.roles.includes(r.id) && r.color)
                    .sort((a, b) => b.position - a.position)[0];
                  return (
                    <li key={u.id}>
                      <button
                        onClick={() => u.id !== state.me?.id && onDm(u.id)}
                        className={`flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left hover:bg-paper-3/60 ${st === "offline" ? "opacity-50" : ""}`}
                      >
                        <UserAvatar user={u} size={32} status={st} ring="border-paper-2" />
                        <span className="min-w-0 leading-tight">
                          <span className="flex items-center gap-1.5">
                            <span
                              className="truncate text-[15px] font-medium"
                              style={top ? { color: `#${top.color.toString(16).padStart(6, "0")}` } : undefined}
                            >
                              {m.nick || displayName(u)}
                            </span>
                            {guild.owner_id === u.id && <Crown size={13} className="shrink-0 text-mustard" aria-label="Dono" />}
                          </span>
                          <span className="block truncate text-xs text-muted">{st !== "offline" && custom ? custom : STATUS_PT[st]}</span>
                        </span>
                      </button>
                    </li>
                  );
                })}
            </ul>
          </div>
        ))}
    </aside>
  );
}
