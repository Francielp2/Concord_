import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/app",
    name: "Concord",
    short_name: "Concord",
    description: "Servidores, canais, voz e conversa direta pro seu grupo.",
    lang: "pt-BR",
    start_url: "/app",
    scope: "/",
    display: "standalone",
    background_color: "#191714",
    theme_color: "#191714",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
