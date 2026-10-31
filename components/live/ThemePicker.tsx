"use client";

import { Check } from "lucide-react";
import { THEMES, setTheme, useTheme } from "@/lib/client/theme";

// Cada cartão é uma miniatura do app naquele tema: o data-theme aninhado redefine os tokens só ali dentro.
export function ThemePicker() {
  const current = useTheme();
  return (
    <div role="radiogroup" aria-label="Tema" className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-3">
      {THEMES.map((t) => {
        const on = current === t.id;
        return (
          <button
            key={t.id}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => setTheme(t.id)}
            className={`relative rounded-2xl border p-2 text-left ${on ? "border-signal ring-2 ring-signal/40" : "border-line hover:border-line-strong"}`}
          >
            <span data-theme={t.id} className="app-backdrop flex h-16 overflow-hidden rounded-xl p-1" aria-hidden>
              <span className="flex h-full w-full overflow-hidden rounded-lg bg-rail">
                <span className="flex w-4 shrink-0 flex-col items-center gap-1 pt-1">
                  <span className="h-2.5 w-2.5 rounded-[4px] bg-signal" />
                  <span className="h-2.5 w-2.5 rounded-[4px] bg-rail-3" />
                </span>
                <span className="w-1/3 shrink-0 space-y-1 bg-paper-2 p-1">
                  <span className="block h-1 w-3/4 rounded bg-muted" />
                  <span className="block h-2 rounded bg-channel-active" />
                  <span className="block h-1 w-2/3 rounded bg-faint/60" />
                </span>
                <span className="flex-1 space-y-1 bg-sheet p-1">
                  <span className="block h-1 w-1/2 rounded bg-ink" />
                  <span className="block h-1 w-5/6 rounded bg-muted" />
                  <span className="block h-1 w-2/3 rounded bg-muted" />
                  <span className="block h-2 w-1/2 rounded-full bg-signal" />
                </span>
              </span>
            </span>
            <span className="mt-1.5 block text-sm font-semibold leading-tight">{t.name}</span>
            <span className="block text-xs leading-snug text-muted">{t.hint}</span>
            {on && (
              <span className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-signal text-on-signal">
                <Check size={13} />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
