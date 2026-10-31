// Service worker mínimo: existe para o app poder ser instalado e para as notificações do sistema.
// Sem evento fetch de propósito. O Concord depende de rede (gateway SSE, voz, API), e
// passar isso por um cache só traria respostas velhas.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

// Clicar na notificação (ou em Atender/Recusar) foca o app e pede para ele abrir o que precisar.
// Recusar não precisa trazer a janela para a frente. Com o site fechado, abre o app na conversa.
self.addEventListener("notificationclick", (event) => {
  const data = event.notification.data || {};
  const action = event.action || "open";
  event.notification.close();
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const app = windows.find((w) => new URL(w.url).pathname.startsWith("/app"));
      if (app) {
        app.postMessage({ type: "concord:notification", action, data });
        if (action !== "decline") await app.focus();
        return;
      }
      if (action === "decline") return;
      const query = data.guildId ? `guild=${data.guildId}&channel=${data.channelId}` : data.channelId ? `dm=${data.channelId}` : "";
      await self.clients.openWindow(`/app${query ? `?${query}` : ""}`);
    })(),
  );
});
