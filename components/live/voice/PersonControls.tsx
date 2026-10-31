"use client";

import { MicOff, MonitorUp, Volume2, VolumeX, X } from "lucide-react";
import { useState } from "react";
import { api } from "@/lib/client/api";
import { displayName, useStore } from "@/lib/client/store";
import { Perm, hasPerm, type ApiVoiceState } from "@/lib/client/types";
import { personPrefs, setPersonPrefs, useVoicePrefs } from "@/lib/client/voicePrefs";

// Silêncio e volume de uma pessoa, em linha: abre sem ser cortado pela barra rolável
// nem pelo tile, e funciona em tela cheia, onde um portal ficaria invisível.
export function PersonControls({
  identity,
  guildId,
  showScreenVolume,
  tone = "paper",
  onClose,
}: {
  identity: string;
  guildId: string;
  showScreenVolume?: boolean;
  tone?: "paper" | "dark";
  onClose: () => void;
}) {
  const { state } = useStore();
  const prefs = useVoicePrefs();
  const person = personPrefs(prefs, identity);
  const [error, setError] = useState("");
  const guild = state.guilds[guildId];
  const voice: ApiVoiceState | undefined = guild?.voice_states.find((v) => v.user_id === identity);
  const canServerMute = hasPerm(guild?.permissions, Perm.MUTE_MEMBERS) && identity !== state.me?.id;
  const box = tone === "dark" ? "bg-chrome-2 text-on-chrome" : "bg-paper-3/60 text-ink";

  async function serverMute(mute: boolean) {
    setError("");
    await api(`/guilds/${guildId}/voice-states/${identity}`, { method: "PATCH", body: { mute } }).catch((e) => setError(e.message));
  }

  return (
    <div className={`rounded-xl p-2 text-xs ${box}`}>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <b className="truncate">{displayName(state.users[identity])}</b>
        <button aria-label="Fechar opções" onClick={onClose} className="opacity-70 hover:opacity-100">
          <X size={14} />
        </button>
      </div>
      <label className="flex items-center gap-2">
        <Volume2 size={14} className="shrink-0" />
        <span className="w-20 shrink-0">Voz</span>
        <input
          type="range"
          min={0}
          max={100}
          value={Math.round(person.volume * 100)}
          aria-label={`Volume de ${displayName(state.users[identity])}`}
          onChange={(e) => setPersonPrefs(identity, { volume: Number(e.target.value) / 100 })}
          className="min-w-0 flex-1 accent-signal"
        />
        <span className="w-8 text-right font-mono">{Math.round(person.volume * 100)}</span>
      </label>
      {showScreenVolume && (
        <label className="mt-1 flex items-center gap-2">
          <MonitorUp size={14} className="shrink-0" />
          <span className="w-20 shrink-0">Áudio da tela</span>
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(person.screenVolume * 100)}
            aria-label={`Volume do áudio da tela de ${displayName(state.users[identity])}`}
            onChange={(e) => setPersonPrefs(identity, { screenVolume: Number(e.target.value) / 100 })}
            className="min-w-0 flex-1 accent-signal"
          />
          <span className="w-8 text-right font-mono">{Math.round(person.screenVolume * 100)}</span>
        </label>
      )}
      <button
        onClick={() => setPersonPrefs(identity, { muted: !person.muted })}
        className="mt-1.5 flex w-full items-center gap-2 rounded px-1 py-1 text-left font-semibold hover:opacity-75"
      >
        <VolumeX size={14} className={person.muted ? "text-dnd" : ""} />
        {person.muted ? "Voltar a ouvir" : "Silenciar pra mim"}
      </button>
      {canServerMute && voice && (
        <button
          onClick={() => serverMute(!voice.mute)}
          className="flex w-full items-center gap-2 rounded px-1 py-1 text-left font-semibold text-dnd hover:bg-dnd/10"
        >
          <MicOff size={14} />
          {voice.mute ? "Liberar o microfone" : "Silenciar pra todos"}
        </button>
      )}
      {error && <p className="mt-1 text-dnd">{error}</p>}
    </div>
  );
}
