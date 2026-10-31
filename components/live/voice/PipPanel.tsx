"use client";

import { HeadphoneOff, Headphones, Mic, MicOff } from "lucide-react";
import { useStore } from "@/lib/client/store";
import type { ThemeId } from "@/lib/client/theme";
import { accentVars } from "@/lib/client/theme";
import { UserAvatar } from "../ui";
import { CallTimer } from "./CallTimer";
import { LeaveButton } from "./LeaveButton";
import type { PipPerson } from "./useParticipantPip";

// Conteúdo da janela flutuante. Renderizado por portal, então recebe o estado da aba principal ao vivo.
export function PipPanel({
  people,
  title,
  status,
  startedAt,
  muted,
  deaf,
  accent,
  theme,
  onMute,
  onDeaf,
  onLeave,
}: {
  people: PipPerson[];
  title: string;
  status: string;
  startedAt: number | null;
  muted: boolean;
  deaf: boolean;
  accent: number | null | undefined;
  theme: ThemeId;
  onMute: () => void;
  onDeaf: () => void;
  onLeave: () => void;
}) {
  const { state } = useStore();
  const btn = "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-paper-3 text-ink-3 hover:text-ink";
  return (
    <div style={accentVars(accent, theme)} className="flex h-dvh flex-col bg-sheet text-ink" data-pip-panel>
      <header className="shrink-0 border-b border-line px-3 py-2 leading-tight">
        <b className="block truncate font-display text-sm">{title}</b>
        <span className="flex items-center gap-1.5 text-xs text-muted">
          <span className="min-w-0 truncate">{status}</span>
          <CallTimer startedAt={startedAt} />
        </span>
      </header>
      <ul className="scroll-thin min-h-0 flex-1 space-y-0.5 overflow-y-auto p-2">
        {people.map((p) => (
          <li key={p.id} className="flex items-center gap-2.5 rounded-xl px-1.5 py-1.5">
            <span className={`shrink-0 rounded-full ${p.speaking ? "ring-2 ring-online ring-offset-2 ring-offset-sheet" : ""}`}>
              <UserAvatar user={state.users[p.id]} size={32} />
            </span>
            <span className={`min-w-0 flex-1 truncate text-sm ${p.speaking ? "font-semibold" : ""}`}>{p.name}</span>
            {!p.micOn && <MicOff size={15} className="shrink-0 text-dnd" aria-label="Mudo" />}
          </li>
        ))}
      </ul>
      <footer className="flex shrink-0 items-center gap-2 border-t border-line p-2">
        <button className={btn} aria-label={muted ? "Ativar microfone" : "Silenciar"} onClick={onMute}>
          {muted ? <MicOff size={18} className="text-dnd" /> : <Mic size={18} />}
        </button>
        <button className={btn} aria-label={deaf ? "Voltar a ouvir" : "Ensurdecer"} onClick={onDeaf}>
          {deaf ? <HeadphoneOff size={18} className="text-dnd" /> : <Headphones size={18} />}
        </button>
        <LeaveButton onLeave={onLeave} className="ml-auto !h-11" />
      </footer>
    </div>
  );
}
