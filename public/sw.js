// Service worker mínimo: só existe para o app poder ser instalado.
// Sem evento fetch de propósito. O Concord depende de rede (gateway SSE, voz, API), e
// passar isso por um cache só traria respostas velhas.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
