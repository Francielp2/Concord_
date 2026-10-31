"use client";

import { useState } from "react";

// A arte é public/friends-hero.webp. O SVG, feito só com as variáveis do tema, só aparece se ela não carregar.
export function FriendsBanner() {
  const [noHero, setNoHero] = useState(false);
  return (
    <div className="relative flex min-h-40 items-center overflow-hidden rounded-2xl border border-line bg-paper-2 shadow-soft board:h-[235px]" data-friends-banner>
      {noHero && (
      <svg
        aria-hidden
        viewBox="0 0 420 160"
        preserveAspectRatio="xMaxYMax slice"
        className="absolute inset-y-0 right-0 h-full w-[46%] [mask-image:linear-gradient(to_right,transparent,#000_32%)] sm:w-[62%] board:w-[66%]"
      >
        <defs>
          <linearGradient id="friends-banner-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="color-mix(in srgb, var(--color-signal) 62%, var(--color-paper-2))" />
            <stop offset="1" stopColor="color-mix(in srgb, var(--color-signal) 16%, var(--color-paper-2))" />
          </linearGradient>
        </defs>
        <rect width="420" height="160" fill="url(#friends-banner-sky)" />
        <circle cx="318" cy="48" r="26" fill="var(--banner-moon)" />
        <g fill="var(--banner-moon)">
          <circle cx="216" cy="30" r="1.6" />
          <circle cx="252" cy="62" r="1.2" />
          <circle cx="382" cy="26" r="1.6" />
          <circle cx="396" cy="72" r="1.2" />
          <circle cx="180" cy="58" r="1.2" />
        </g>
        <path d="M60 160 L170 62 L236 118 L300 70 L420 150 V160 Z" fill="color-mix(in srgb, var(--color-signal) 48%, var(--color-paper-3))" />
        <path d="M120 160 L226 96 L292 138 L366 92 L420 124 V160 Z" fill="color-mix(in srgb, var(--color-signal) 72%, var(--color-chrome))" />
      </svg>
      )}
      {!noHero && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src="/friends-hero.webp"
          alt=""
          onError={() => setNoHero(true)}
          data-friends-hero
          className="absolute inset-y-0 right-0 h-full w-[46%] object-cover object-right [mask-image:linear-gradient(to_right,transparent,#000_32%)] sm:w-[62%] board:w-[66%]"
        />
      )}
      <div className="relative max-w-[60%] px-4 py-5 sm:max-w-[52%] sm:px-6 board:max-w-[50%]">
        <h2 className="font-display text-xl font-extrabold leading-tight sm:text-2xl board:text-[32px]">
          Encontre seus amigos no <span className="text-signal-ink">Concord</span>
        </h2>
        <p className="mt-1.5 text-xs leading-snug text-muted sm:text-sm board:mt-3 board:text-base">Adicione a galera, veja quem está on e entre na chamada com um clique.</p>
      </div>
    </div>
  );
}
