"use client";

import { Volume2 } from "lucide-react";
import type { ApiSound } from "@/lib/client/types";
import { setSoundboardVolume, useVoicePrefs } from "@/lib/client/voicePrefs";

export function Soundboard({
  sounds,
  cooling,
  onPlay,
}: {
  sounds: ApiSound[];
  cooling: boolean;
  onPlay: (sound: ApiSound) => void;
}) {
  const prefs = useVoicePrefs();
  return (
    <div className="rounded-lg bg-chrome-2 p-2 text-xs text-on-chrome">
      <label className="mb-2 flex items-center gap-2">
        <Volume2 size={14} className="shrink-0" />
        <span className="shrink-0">Volume dos sons</span>
        <input
          type="range"
          min={0}
          max={100}
          value={Math.round(prefs.soundboardVolume * 100)}
          aria-label="Volume dos sons"
          onChange={(e) => setSoundboardVolume(Number(e.target.value) / 100)}
          className="min-w-0 flex-1 accent-signal"
        />
      </label>
      {sounds.length ? (
        <div className="scroll-thin grid max-h-40 grid-cols-2 gap-1.5 overflow-y-auto sm:grid-cols-3">
          {sounds.map((s) => (
            <button
              key={s.id}
              disabled={cooling}
              onClick={() => onPlay(s)}
              className="truncate rounded-md bg-chrome-3 px-2 py-2 font-semibold hover:bg-signal hover:text-on-signal disabled:opacity-40"
            >
              {s.name}
            </button>
          ))}
        </div>
      ) : (
        <p className="py-2 text-center opacity-70">Este servidor ainda não tem sons.</p>
      )}
    </div>
  );
}
