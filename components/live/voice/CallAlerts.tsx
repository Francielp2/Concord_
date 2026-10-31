"use client";

import { Phone, PhoneOff, X } from "lucide-react";
import { displayName } from "@/lib/client/store";
import { UserAvatar } from "../ui";
import type { IncomingCall } from "./useDmCall";

// Fora do quadro com zoom e acima de tudo: chamada recebida não pode ficar atrás de um modal.
export function IncomingCallCard({ call, queued, onAccept, onDecline }: { call: IncomingCall; queued: number; onAccept: () => void; onDecline: () => void }) {
  const name = displayName(call.caller);
  return (
    <div
      role="alertdialog"
      aria-label={`${name} está ligando`}
      className="fixed right-3 top-3 z-[120] w-[calc(100vw-1.5rem)] max-w-xs rounded-2xl border border-line-strong bg-sheet p-3 text-ink shadow-pop"
      data-incoming-call
    >
      <div className="flex items-center gap-3">
        <span className="rounded-full motion-safe:animate-pulse">
          <UserAvatar user={call.caller} size={44} />
        </span>
        <span className="min-w-0 flex-1 leading-tight">
          <span className="block truncate font-semibold">{name} está ligando</span>
          <span className="block text-xs text-muted">{queued ? `Chamada particular · mais ${queued} na fila` : "Chamada particular"}</span>
        </span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button type="button" onClick={onAccept} className="flex h-11 items-center justify-center gap-1.5 rounded-xl bg-online text-sm font-semibold text-sheet hover:brightness-110 md:h-9">
          <Phone size={16} aria-hidden /> Atender
        </button>
        <button type="button" onClick={onDecline} className="flex h-11 items-center justify-center gap-1.5 rounded-xl bg-danger text-sm font-semibold text-on-danger hover:brightness-110 md:h-9">
          <PhoneOff size={16} aria-hidden /> Recusar
        </button>
      </div>
    </div>
  );
}

export function CallNotice({ text, onClose }: { text: string; onClose: () => void }) {
  return (
    <div role="status" className="fixed left-1/2 top-3 z-[115] flex max-w-[calc(100vw-1.5rem)] -translate-x-1/2 items-center gap-2 rounded-full border border-line-strong bg-sheet py-1.5 pl-4 pr-1.5 text-sm font-semibold text-ink shadow-pop" data-call-notice>
      <span className="min-w-0 truncate">{text}</span>
      <button type="button" aria-label="Fechar aviso" onClick={onClose} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted hover:bg-paper-3 hover:text-ink">
        <X size={14} />
      </button>
    </div>
  );
}
