import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Instrument_Serif, JetBrains_Mono, Inter_Tight } from "next/font/google";
import "./globals.css";

const display = Bricolage_Grotesque({
  variable: "--ff-display",
  subsets: ["latin"],
  weight: ["500", "700", "800"],
});

const serif = Instrument_Serif({
  variable: "--ff-serif",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
});

const body = Inter_Tight({
  variable: "--ff-body",
  subsets: ["latin"],
});

const mono = JetBrains_Mono({
  variable: "--ff-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Concord",
  description: "Servidores, canais, voz e conversa direta pro seu grupo.",
  appleWebApp: { capable: true, title: "Concord", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#191714",
  viewportFit: "cover",
  // o teclado do celular encolhe a página, e o campo de mensagem fica acima dele
  interactiveWidget: "resizes-content",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      suppressHydrationWarning
      className={`${display.variable} ${serif.variable} ${body.variable} ${mono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
