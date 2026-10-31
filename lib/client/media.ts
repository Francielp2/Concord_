export type ScreenShareSupport = "ok" | "mobile" | "unsupported";

// getDisplayMedia não existe em navegador de celular. O teste de aparelho vem junto porque
// alguns definem a função e só falham ao chamar.
export function screenShareSupport(): ScreenShareSupport {
  // os tipos dizem que mediaDevices sempre existe; em página sem HTTPS, não existe
  const nav = navigator as Omit<Navigator, "mediaDevices"> & { mediaDevices?: Partial<MediaDevices>; userAgentData?: { mobile?: boolean } };
  const mobile =
    nav.userAgentData?.mobile === true ||
    /Android|iPhone|iPad|iPod/i.test(nav.userAgent) ||
    (nav.platform === "MacIntel" && nav.maxTouchPoints > 1);
  if (mobile) return "mobile";
  return nav.mediaDevices?.getDisplayMedia ? "ok" : "unsupported";
}

export const SCREEN_SHARE_MESSAGE: Record<Exclude<ScreenShareSupport, "ok">, string> = {
  mobile: "Compartilhar a tela só funciona no computador. Daqui dá pra assistir quem está transmitindo.",
  unsupported: "Este navegador não consegue compartilhar a tela. Usa Chrome, Edge ou Firefox, em HTTPS.",
};

// ---- áudio da tela: quem decide o que vem é o navegador ----

export type ScreenAudioSupport = "system" | "tab" | "none";

export function screenAudioSupport(): ScreenAudioSupport {
  const ua = navigator.userAgent;
  const chromium = /Chrome\/|Chromium\/|Edg\//.test(ua);
  if (!chromium) return "none"; // Firefox e Safari não capturam áudio de tela
  return /Windows|CrOS/.test(ua) ? "system" : "tab";
}

export const SCREEN_AUDIO_HINT: Record<ScreenAudioSupport, string> = {
  system: "Compartilhar tela. Para ir com som, escolha \"Tela inteira\" e marque \"Compartilhar áudio do sistema\", ou escolha uma aba. Janela avulsa não leva som.",
  tab: "Compartilhar tela. Neste sistema o navegador só envia o áudio de uma aba: tela inteira e janela vão sem som.",
  none: "Compartilhar tela. Este navegador não captura o áudio da tela: só a imagem vai para a chamada.",
};

export const SCREEN_NO_AUDIO_NOTICE =
  "Sua tela está indo sem som. No Windows, escolha 'Tela inteira' e marque 'Compartilhar áudio do sistema'. No Mac e no Linux o navegador só envia o áudio de uma aba.";
export const SCREEN_AUDIO_ENDED_NOTICE = "O áudio da tela parou, mas a imagem continua. Para voltar o som, pare e compartilhe de novo.";
export const SCREEN_ECHO_NOTICE =
  "O som do computador inclui as vozes da chamada, e quem fala pode ouvir o próprio eco. Atualize o navegador ou compartilhe uma aba para evitar isso.";

// Sem restrictOwnAudio, capturar o sistema inteiro manda as vozes da chamada de volta para a sala.
export const canRestrictOwnAudio = () => "restrictOwnAudio" in navigator.mediaDevices.getSupportedConstraints();

// suppressLocalAudioPlayback e restrictOwnAudio são restrições da faixa: precisam ir dentro de "audio".
export function screenCaptureOptions() {
  return {
    audio: {
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
      suppressLocalAudioPlayback: true,
      ...(canRestrictOwnAudio() ? { restrictOwnAudio: true } : {}),
    },
    systemAudio: "include",
    selfBrowserSurface: "exclude",
  } as const;
}
