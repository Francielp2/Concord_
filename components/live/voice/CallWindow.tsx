"use client";

import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { AnimatePresence, motion, useDragControls, useMotionValue } from "framer-motion";
import { GripHorizontal, Maximize, Minimize, Music, X } from "lucide-react";
import { displayName, useStore } from "@/lib/client/store";
import type { ApiSound } from "@/lib/client/types";
import { setWindowPos, useVoicePrefs } from "@/lib/client/voicePrefs";
import { PersonControls } from "./PersonControls";
import { CallTimer } from "./CallTimer";
import { Soundboard } from "./Soundboard";
import { Tile } from "./Tile";
import type { Tile as TileData } from "./useVoiceRoom";

const DESKTOP = "(min-width: 768px)";

function subscribeDesktop(fn: () => void) {
  const mq = window.matchMedia(DESKTOP);
  mq.addEventListener("change", fn);
  return () => mq.removeEventListener("change", fn);
}

export function useIsDesktop() {
  return useSyncExternalStore(subscribeDesktop, () => window.matchMedia(DESKTOP).matches, () => true);
}

type CallProps = {
  tiles: TileData[];
  startedAt: number | null;
  guildId: string;
  sounds: ApiSound[];
  canPlaySounds: boolean;
  boardOpen: boolean;
  cooling: boolean;
  onToggleBoard: () => void;
  onPlay: (sound: ApiSound) => void;
  sheetFooter?: React.ReactNode; // controles extras no bottom sheet, onde a barra lateral fica escondida
};

function useTileName() {
  const { state } = useStore();
  return (t: TileData) => (t.local ? "Você" : displayName(state.users[t.identity]));
}

// Janela da chamada: arrastável no computador, bottom sheet no celular,
// e um modo expandido com quem transmite em destaque.
export function CallWindow({
  open,
  expanded,
  onClose,
  onExpand,
  onCollapse,
  ...call
}: CallProps & {
  open: boolean;
  expanded: boolean;
  onClose: () => void;
  onExpand: () => void;
  onCollapse: () => void;
}) {
  const desktop = useIsDesktop();
  return (
    <>
      <AnimatePresence>
        {open && !expanded && desktop && <FloatingWindow key="floating" onClose={onClose} onExpand={onExpand} {...call} />}
        {open && !expanded && !desktop && <BottomSheet key="sheet" onClose={onClose} onExpand={onExpand} {...call} />}
      </AnimatePresence>
      {expanded && <Expanded onCollapse={onCollapse} {...call} />}
    </>
  );
}

function CallBody({ tiles, guildId, sounds, canPlaySounds, boardOpen, cooling, onPlay }: CallProps) {
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const nameOf = useTileName();
  const screenOwner = menuFor ? tiles.some((t) => t.identity === menuFor && t.kind === "screen") : false;
  return (
    <>
      <div className={`grid gap-2 ${tiles.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
        {tiles.map((t) => (
          <Tile key={t.key} tile={t} name={nameOf(t)} onMenu={() => setMenuFor((m) => (m === t.identity ? null : t.identity))} />
        ))}
      </div>
      {menuFor && (
        <div className="mt-2">
          <PersonControls identity={menuFor} guildId={guildId} tone="dark" showScreenVolume={screenOwner} onClose={() => setMenuFor(null)} />
        </div>
      )}
      {boardOpen && canPlaySounds && (
        <div className="mt-2">
          <Soundboard sounds={sounds} cooling={cooling} onPlay={onPlay} />
        </div>
      )}
    </>
  );
}

function WindowButtons({
  canPlaySounds,
  boardOpen,
  onToggleBoard,
  onExpand,
  onClose,
}: {
  canPlaySounds: boolean;
  boardOpen: boolean;
  onToggleBoard: () => void;
  onExpand: () => void;
  onClose: () => void;
}) {
  const btn = "flex h-7 w-7 items-center justify-center rounded text-on-chrome hover:bg-chrome-3";
  return (
    <div className="flex items-center gap-0.5">
      {canPlaySounds && (
        <button className={`${btn} ${boardOpen ? "bg-chrome-3" : ""}`} aria-label="Soundboard" onClick={onToggleBoard}>
          <Music size={15} />
        </button>
      )}
      <button className={btn} aria-label="Expandir chamada" onClick={onExpand}>
        <Maximize size={15} />
      </button>
      <button className={btn} aria-label="Esconder chamada" onClick={onClose}>
        <X size={15} />
      </button>
    </div>
  );
}

function FloatingWindow({ onClose, onExpand, ...call }: CallProps & { onClose: () => void; onExpand: () => void }) {
  const prefs = useVoicePrefs();
  const bounds = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const controls = useDragControls();
  const x = useMotionValue(prefs.windowPos?.x ?? 0);
  const y = useMotionValue(prefs.windowPos?.y ?? 0);

  // posição salva em outra tela (ou janela maior) pode ficar fora da área visível
  useLayoutEffect(() => {
    const clamp = () => {
      const el = panel.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      if (r.right > window.innerWidth) x.set(x.get() - (r.right - window.innerWidth));
      if (r.left < 0) x.set(x.get() - r.left);
      if (r.bottom > window.innerHeight) y.set(y.get() - (r.bottom - window.innerHeight));
      if (r.top < 0) y.set(y.get() - r.top);
    };
    clamp();
    window.addEventListener("resize", clamp);
    return () => window.removeEventListener("resize", clamp);
  }, [x, y]);

  return (
    <div ref={bounds} className="pointer-events-none fixed inset-0 z-[60]">
      <motion.div
        ref={panel}
        drag
        dragListener={false}
        dragControls={controls}
        dragMomentum={false}
        dragElastic={0}
        dragConstraints={bounds}
        onDragEnd={() => setWindowPos({ x: x.get(), y: y.get() })}
        style={{ x, y }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="pointer-events-auto absolute right-4 top-14 w-[420px] max-w-[calc(100vw-2rem)] rounded-2xl border border-chrome-3 bg-chrome p-2 shadow-hard"
        data-call-window
      >
        <div className="mb-1 flex items-center justify-between">
          <div
            onPointerDown={(e) => controls.start(e)}
            className="flex flex-1 cursor-grab touch-none select-none items-center gap-2 rounded px-1 py-0.5 text-faint active:cursor-grabbing"
            data-drag-handle
          >
            <GripHorizontal size={16} />
            <span className="text-xs font-semibold">{call.tiles.filter((t) => t.kind === "camera").length} na chamada</span>
            <CallTimer startedAt={call.startedAt} className="text-xs font-semibold" />
          </div>
          <WindowButtons
            canPlaySounds={call.canPlaySounds}
            boardOpen={call.boardOpen}
            onToggleBoard={call.onToggleBoard}
            onExpand={onExpand}
            onClose={onClose}
          />
        </div>
        <div className="scroll-thin max-h-[calc(100dvh-7rem)] overflow-y-auto">
          <CallBody {...call} />
        </div>
      </motion.div>
    </div>
  );
}

function BottomSheet({ onClose, onExpand, ...call }: CallProps & { onClose: () => void; onExpand: () => void }) {
  return (
    <>
      <motion.button
        aria-label="Fechar chamada"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-[59] bg-scrim/50"
      />
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "tween", duration: 0.2 }}
        className="fixed inset-x-0 bottom-0 z-[60] max-h-[75dvh] overflow-y-auto rounded-t-2xl bg-chrome p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]"
        data-call-sheet
      >
        <div className="mb-1 flex items-center justify-between px-1">
          <span className="flex items-center gap-2 text-xs font-semibold text-faint">
            {call.tiles.filter((t) => t.kind === "camera").length} na chamada
            <CallTimer startedAt={call.startedAt} />
          </span>
          <WindowButtons
            canPlaySounds={call.canPlaySounds}
            boardOpen={call.boardOpen}
            onToggleBoard={call.onToggleBoard}
            onExpand={onExpand}
            onClose={onClose}
          />
        </div>
        <CallBody {...call} />
        {call.sheetFooter}
      </motion.div>
    </>
  );
}

function Expanded({ onCollapse, ...call }: CallProps & { onCollapse: () => void }) {
  const { tiles, guildId } = call;
  const [pinned, setPinned] = useState<string | null>(null);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const nameOf = useTileName();

  // Esc também vale sem tela cheia de verdade (iPhone, ou quando o navegador recusou)
  const collapse = useRef(onCollapse);
  useEffect(() => {
    collapse.current = onCollapse;
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && collapse.current();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const focus = tiles.find((t) => t.key === pinned) ?? tiles.find((t) => t.kind === "screen") ?? tiles.find((t) => t.video) ?? tiles[0];
  const rest = tiles.filter((t) => t.key !== focus?.key);
  const screenOwner = menuFor ? tiles.some((t) => t.identity === menuFor && t.kind === "screen") : false;

  return (
    <div className="fixed inset-0 z-[70] flex flex-col gap-2 bg-chrome p-2 pt-[max(0.5rem,env(safe-area-inset-top))]" data-call-expanded>
      <div className="flex shrink-0 items-center justify-between px-1">
        <span className="flex items-center gap-2 text-xs font-semibold text-faint">
          {tiles.filter((t) => t.kind === "camera").length} na chamada
          <CallTimer startedAt={call.startedAt} />
        </span>
        <div className="flex items-center gap-0.5">
          {call.canPlaySounds && (
            <button
              aria-label="Soundboard"
              onClick={call.onToggleBoard}
              className={`flex h-8 w-8 items-center justify-center rounded text-on-chrome hover:bg-chrome-3 ${call.boardOpen ? "bg-chrome-3" : ""}`}
            >
              <Music size={16} />
            </button>
          )}
          <button
            aria-label="Sair da tela cheia"
            onClick={onCollapse}
            className="flex h-8 items-center gap-1.5 rounded px-2 text-sm font-semibold text-on-chrome hover:bg-chrome-3"
          >
            <Minimize size={16} /> Sair
          </button>
        </div>
      </div>
      <div className="min-h-0 flex-1">
        {focus && <Tile tile={focus} name={nameOf(focus)} fill onMenu={() => setMenuFor((m) => (m === focus.identity ? null : focus.identity))} />}
      </div>
      {!!rest.length && (
        <div className="scroll-thin flex shrink-0 gap-2 overflow-x-auto pb-1" data-call-strip>
          {rest.map((t) => (
            <div key={t.key} className="w-40 shrink-0 sm:w-52">
              <Tile
                tile={t}
                name={nameOf(t)}
                onPin={() => setPinned(t.key)}
                onMenu={() => setMenuFor((m) => (m === t.identity ? null : t.identity))}
              />
            </div>
          ))}
        </div>
      )}
      {menuFor && (
        <div className="mx-auto w-full max-w-md shrink-0">
          <PersonControls identity={menuFor} guildId={guildId} tone="dark" showScreenVolume={screenOwner} onClose={() => setMenuFor(null)} />
        </div>
      )}
      {call.boardOpen && call.canPlaySounds && (
        <div className="mx-auto w-full max-w-md shrink-0">
          <Soundboard sounds={call.sounds} cooling={call.cooling} onPlay={call.onPlay} />
        </div>
      )}
    </div>
  );
}
