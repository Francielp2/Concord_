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
