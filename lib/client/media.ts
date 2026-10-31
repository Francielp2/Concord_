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
