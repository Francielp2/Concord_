"use client";

import { Maximize, MoreVertical, VolumeX } from "lucide-react";
import { useEffect, useRef } from "react";
import type { Track } from "livekit-client";
import { useStore } from "@/lib/client/store";
import { personPrefs, useVoicePrefs } from "@/lib/client/voicePrefs";
import { UserAvatar } from "../ui";
import type { Tile as TileData } from "./useVoiceRoom";

type IosVideo = HTMLVideoElement & { webkitEnterFullscreen?: () => void };

export function Tile({
  tile,
  name,
  fill,
  onMenu,
  onPin,
}: {
  tile: TileData;
  name: string;
  fill?: boolean; // ocupa o espaço disponível em vez de manter 16:9
  onMenu?: () => void;
  onPin?: () => void;
}) {
  const { state } = useStore();
  const prefs = useVoicePrefs();
  const rootRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const screen = tile.kind === "screen";

  useEffect(() => {
    const el = videoRef.current;
    const track = tile.video as unknown as Track | null;
    if (!el || !track) return;
    track.attach(el);
    return () => {
      track.detach(el);
    };
  }, [tile.video]);

  function fullscreen(e: React.MouseEvent) {
    e.stopPropagation();
    const root = rootRef.current;
    const video = videoRef.current as IosVideo | null;
    if (root?.requestFullscreen) root.requestFullscreen().catch(() => video?.webkitEnterFullscreen?.());
    // iPhone não tem tela cheia de elemento, só a do próprio <video>
    else video?.webkitEnterFullscreen?.();
  }

  const overlayBtn = "flex h-7 w-7 items-center justify-center rounded bg-chrome/80 text-on-chrome hover:bg-chrome";

  return (
    <div
      ref={rootRef}
      onClick={onPin}
      className={`group relative flex items-center justify-center overflow-hidden rounded-xl bg-chrome-2 ${fill ? "h-full w-full" : "aspect-video"} ${
        onPin ? "cursor-pointer" : ""
      } ${tile.speaking && !screen ? "ring-2 ring-online" : "ring-1 ring-chrome-3"}`}
    >
      {tile.video ? (
        // o áudio vai por elementos próprios; o vídeo fica sempre mudo, o que também libera o autoplay
        <video ref={videoRef} autoPlay playsInline muted className={`h-full w-full ${screen ? "object-contain" : "object-cover"}`} />
      ) : (
        <UserAvatar user={state.users[tile.identity]} size={48} />
      )}
      <span className="absolute bottom-1.5 left-1.5 flex max-w-[80%] items-center gap-1 rounded bg-chrome/80 px-1.5 py-0.5 text-[11px] font-semibold text-on-chrome">
        <span className="truncate">{screen ? `Tela de ${name}` : name}</span>
        {!screen && !tile.micOn && <span className="shrink-0"> · mudo</span>}
        {screen && <span className="shrink-0"> · {tile.screenAudio ? "com som" : "sem som"}</span>}
        {!tile.local && personPrefs(prefs, tile.identity).muted && <VolumeX size={12} className="shrink-0 text-dnd" aria-label="Silenciado pra você" />}
      </span>
      <div className="absolute right-1.5 top-1.5 flex gap-1 transition-opacity [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:focus-within:opacity-100">
        {tile.video && (
          <button className={overlayBtn} aria-label="Tela cheia" onClick={fullscreen}>
            <Maximize size={14} />
          </button>
        )}
        {onMenu && !tile.local && (
          <button
            className={overlayBtn}
            aria-label={`Opções de ${name}`}
            onClick={(e) => {
              e.stopPropagation();
              onMenu();
            }}
          >
            <MoreVertical size={14} />
          </button>
        )}
      </div>
    </div>
  );
}
