/* eslint-disable @next/next/no-img-element */

// A arte tem a proporção de um recorte: esticada na largura toda ela cortaria a lua e o personagem.
// Fica inteira à direita, e a mesma imagem desfocada preenche o banner até a esquerda.
export function FriendsBanner() {
  return (
    <div
      className="relative flex min-h-40 items-center overflow-hidden rounded-2xl border border-signal/40 bg-paper-2 shadow-[0_0_24px_color-mix(in_srgb,var(--color-signal)_25%,transparent)] board:h-[235px]"
      data-friends-banner
    >
      <img src="/friends-hero.webp" alt="" className="absolute inset-0 h-full w-full scale-110 object-cover blur-md" />
      <img
        src="/friends-hero.webp"
        alt=""
        data-friends-hero
        className="absolute inset-y-0 right-0 h-full w-auto max-w-none [mask-image:linear-gradient(to_right,transparent,#000_32%)]"
      />
      {/* só atrás do texto; sem espaço para a arte ao lado, ele precisa cobrir mais para o texto ficar legível */}
      <span className="absolute inset-y-0 left-0 w-full bg-gradient-to-r from-paper-2 from-70% to-transparent board:w-3/4 board:from-hero-veil board:from-55%" aria-hidden />
      <div className="relative max-w-[66%] px-4 py-5 sm:px-6 board:max-w-[60%] board:px-[31px] board:py-0">
        <h2 className="font-display text-xl font-extrabold leading-tight sm:text-2xl board:text-[36px] board:leading-[47px]">
          Encontre seus amigos <br className="hidden board:block" />
          no <span className="text-signal-ink">Concord</span>
        </h2>
        <p className="mt-1.5 text-xs leading-snug text-ink-2 sm:text-sm board:mt-3 board:max-w-[360px] board:text-[17px] board:leading-6">
          Conecte-se, converse, jogue e compartilhe experiências em um só lugar.
        </p>
      </div>
    </div>
  );
}
