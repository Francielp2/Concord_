"use client";

import { useCallback, useRef, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { Headphones, HeadphoneOff, Mic, MicOff, Settings } from "lucide-react";
import { customStatusText } from "@/lib/client/activity";
import { displayName, statusOf, useStore } from "@/lib/client/store";
import { UserMenu } from "./UserMenu";
import { STATUS_PT, UserAvatar } from "./ui";

export function UserBar({
  muted,
  deaf,
  onMute,
  onDeaf,
  onSettings,
  onActivity,
  onInstallHelp,
}: {
  muted: boolean;
  deaf: boolean;
  onMute: () => void;
  onDeaf: () => void;
  onSettings: () => void;
  onActivity: () => void;
  onInstallHelp: () => void;
}) {
  const { state } = useStore();
  const [menu, setMenu] = useState(false);
  const closeMenu = useCallback(() => setMenu(false), []);
  const bar = useRef<HTMLDivElement>(null);
  const me = state.me;
  const btn = "flex h-8 w-8 items-center justify-center rounded-lg text-ink-3 hover:bg-paper-3 hover:text-ink";

  return (
    <div ref={bar} className="relative flex min-h-[58px] shrink-0 items-center gap-1 border-t border-line bg-paper-3/60 px-2 pb-[env(safe-area-inset-bottom)]">
      <AnimatePresence>
        {menu && <UserMenu anchor={bar} className="bottom-[62px] left-2" onClose={closeMenu} onActivity={onActivity} onInstallHelp={onInstallHelp} />}
      </AnimatePresence>

      <button onClick={() => setMenu((v) => !v)} aria-expanded={menu} className="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-1 py-1 text-left hover:bg-paper-3">
        <UserAvatar user={me ?? undefined} size={34} status={me ? statusOf(state, me.id) : undefined} ring="border-paper-3" />
        <span className="min-w-0 leading-tight">
          <span className="block truncate text-sm font-semibold">{displayName(me)}</span>
          <span className="block truncate text-xs text-muted">
            {state.conn === "ready" ? (customStatusText(state.myCustomStatus) ?? STATUS_PT[state.myStatus]) : "Reconectando…"}
          </span>
        </span>
      </button>
      <button className={btn} aria-label={muted ? "Ativar microfone" : "Silenciar"} onClick={onMute}>
        {muted ? <MicOff size={18} className="text-dnd" /> : <Mic size={18} />}
      </button>
      <button className={btn} aria-label={deaf ? "Voltar a ouvir" : "Ensurdecer"} onClick={onDeaf}>
        {deaf ? <HeadphoneOff size={18} className="text-dnd" /> : <Headphones size={18} />}
      </button>
      <button className={btn} aria-label="Configurações" onClick={onSettings}>
        <Settings size={18} />
      </button>
    </div>
  );
}
