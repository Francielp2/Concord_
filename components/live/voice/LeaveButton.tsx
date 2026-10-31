"use client";

import { PhoneOff } from "lucide-react";

// Sair é sempre um clique só, e fica fora de qualquer condição de "conectado":
// tem que dar pra sair com o áudio fora do ar.
export function LeaveButton({ onLeave, label = "always", className = "" }: { onLeave: () => void; label?: "always" | "roomy" | "never"; className?: string }) {
  return (
    <button
      type="button"
      aria-label="Sair da chamada"
      title="Sair da chamada"
      onClick={onLeave}
      className={`flex h-11 min-w-11 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-danger px-2.5 text-sm font-semibold text-on-danger hover:brightness-110 active:brightness-90 md:h-9 md:min-w-9 ${className}`}
    >
      <PhoneOff size={18} className="shrink-0" />
      {label !== "never" && <span className={label === "roomy" ? "hidden min-[360px]:inline" : ""}>Sair</span>}
    </button>
  );
}
