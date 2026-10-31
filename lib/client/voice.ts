// Id do dispositivo na chamada: um por carregamento da página. Fica na memória de propósito:
// aba duplicada copia o sessionStorage, e duas abas com o mesmo id se confundiriam.
let sessionId: string | null = null;

export function voiceSessionId() {
  if (!sessionId) {
    // getRandomValues funciona em HTTP (teste pela rede local); randomUUID não
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    sessionId = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  }
  return sessionId;
}

// Sai do canal enquanto a página fecha: fetch comum seria cancelado. O corpo vai como text/plain.
export function sendVoiceLeaveBeacon() {
  navigator.sendBeacon("/api/v1/gateway", JSON.stringify({ op: 4, d: { channel_id: null, session_id: voiceSessionId() } }));
}

// mm:ss, e h:mm:ss depois de 1h. Relógio do aparelho atrasado daria negativo: fica em 00:00.
export function formatCallDuration(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const pad = (n: number) => String(n).padStart(2, "0");
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor(total / 60) % 60;
  return hours ? `${hours}:${pad(minutes)}:${pad(total % 60)}` : `${pad(minutes)}:${pad(total % 60)}`;
}
