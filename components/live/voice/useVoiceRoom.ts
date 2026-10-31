"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import type { Participant, RemoteTrack, Room, Track as TrackT, VideoTrack } from "livekit-client";
import { api } from "@/lib/client/api";
import { SCREEN_AUDIO_ENDED_NOTICE, SCREEN_ECHO_NOTICE, SCREEN_NO_AUDIO_NOTICE, canRestrictOwnAudio, screenCaptureOptions } from "@/lib/client/media";
import { playCue, playSound, unlockAudio } from "@/lib/client/sounds";
import type { ApiSound } from "@/lib/client/types";
import { sendVoiceLeaveBeacon } from "@/lib/client/voice";
import { personPrefs, useVoicePrefs, type VoicePrefs } from "@/lib/client/voicePrefs";

export type VoiceStatus = "idle" | "connecting" | "connected" | "unavailable" | "error";

export type Tile = {
  key: string;
  identity: string;
  local: boolean;
  kind: "camera" | "screen";
  video: VideoTrack | null;
  speaking: boolean;
  micOn: boolean;
  screenAudio: boolean; // a transmissão desta pessoa está indo com som
};

const SOUND_TOPIC = "soundboard";
// quem manda respeita o cooldown; quem recebe confere de novo, porque o envio é direto entre clientes
const SOUND_COOLDOWN_MS = 3000;
const SOUND_RECEIVE_GAP_MS = 2500;
const CUE_GAP_MS = 1500;

// valores do enum Track.Source: o livekit-client só carrega quando alguém entra numa chamada
const MIC = "microphone" as TrackT.Source.Microphone;
const SCREEN = "screen_share" as TrackT.Source.ScreenShare;
const SCREEN_AUDIO = "screen_share_audio" as TrackT.Source.ScreenShareAudio;
// som de tela é música e filme: sem cortar nos silêncios, e com mais banda que a voz
const SCREEN_AUDIO_PUBLISH = { audioPreset: { maxBitrate: 128_000 }, dtx: false, red: false };
const SCREEN_NOTICES = [SCREEN_NO_AUDIO_NOTICE, SCREEN_AUDIO_ENDED_NOTICE, SCREEN_ECHO_NOTICE];

function applyAudio(room: Room, deaf: boolean, prefs: VoicePrefs) {
  for (const p of room.remoteParticipants.values()) {
    const person = personPrefs(prefs, p.identity);
    p.setVolume(person.volume, MIC);
    p.setVolume(person.screenVolume, SCREEN_AUDIO);
    for (const pub of p.audioTrackPublications.values()) {
      const silent = deaf || (pub.source === MIC && person.muted);
      pub.track?.attachedElements.forEach((el) => (el.muted = silent));
    }
  }
}

// Conexão com a sala do LiveKit e tudo que depende dela. O estado "quem está em qual canal"
// continua no gateway; aqui só a parte de áudio e vídeo, numa sala por canal.
export function useVoiceRoom({
  audioBox,
  channelId,
  dm,
  sessionId,
  myId,
  muted,
  deaf,
  serverMuted,
  sounds,
  onReplaced,
}: {
  audioBox: RefObject<HTMLDivElement | null>; // onde ficam os elementos de áudio
  channelId: string | null;
  dm: boolean; // chamada de DM: o token vem de outra rota e não existe VoiceState
  sessionId: string;
  myId: string | undefined;
  muted: boolean;
  deaf: boolean;
  serverMuted: boolean;
  sounds: ApiSound[];
  onReplaced: () => void;
}) {
  const prefs = useVoicePrefs();
  const [room, setRoom] = useState<Room | null>(null);
  const [status, setStatus] = useState<VoiceStatus>("idle");
  const [tiles, setTiles] = useState<Tile[]>([]);
  const [camera, setCamera] = useState(false);
  const [screen, setScreen] = useState(false);
  const [micBlocked, setMicBlocked] = useState(false);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const [notice, setNotice] = useState("");
  const [cooling, setCooling] = useState(false);
  const [permissionsTick, setPermissionsTick] = useState(0);
  const lastSent = useRef(0);
  const latest = useRef({ deaf, prefs, sounds, myId, onReplaced, status });
  useEffect(() => {
    latest.current = { deaf, prefs, sounds, myId, onReplaced, status };
  });

  // conecta/desconecta conforme o canal de voz atual
  useEffect(() => {
    if (!channelId) return;
    let cancelled = false;
    let current: Room | null = null;

    (async () => {
      setStatus("connecting");
      let creds: { url: string; token: string };
      try {
        creds = dm
          ? await api("/voice/dm-token", { body: { channel_id: channelId, session_id: sessionId } })
          : await api("/voice/token", { body: { session_id: sessionId } });
      } catch (err) {
        if (cancelled) return;
        const code = (err as { status?: number }).status;
        if (code === 409) latest.current.onReplaced();
        else setStatus(code === 503 ? "unavailable" : "error");
        return;
      }
      const { DisconnectReason, Room, RoomEvent, Track } = await import("livekit-client");
      if (cancelled) return;
      const r = new Room({ adaptiveStream: true, dynacast: true });
      current = r;
      const syncAudio = () => applyAudio(r, latest.current.deaf, latest.current.prefs);

      const refresh = () => {
        const speaking = new Set(r.activeSpeakers.map((p) => p.identity));
        const toTiles = (p: Participant, local: boolean): Tile[] => {
          const base = { identity: p.identity, local, speaking: speaking.has(p.identity), micOn: p.isMicrophoneEnabled, screenAudio: !!p.getTrackPublication(SCREEN_AUDIO) };
          const cam = p.getTrackPublication(Track.Source.Camera)?.videoTrack as VideoTrack | undefined;
          const shared = p.getTrackPublication(Track.Source.ScreenShare)?.videoTrack as VideoTrack | undefined;
          return [
            ...(shared ? [{ ...base, key: `${p.identity}:screen`, kind: "screen" as const, video: shared }] : []),
            { ...base, key: `${p.identity}:camera`, kind: "camera" as const, video: cam ?? null },
          ];
        };
        setTiles([
          ...toTiles(r.localParticipant, true),
          ...[...r.remoteParticipants.values()].flatMap((p) => toTiles(p, false)),
        ]);
        // o próprio navegador pode encerrar a captura ("parar de compartilhar"): o botão acompanha
        setCamera(r.localParticipant.isCameraEnabled);
        setScreen(r.localParticipant.isScreenShareEnabled);
      };

      // a tela parou (inclusive pelo botão do navegador): os avisos sobre o som dela perdem o sentido
      r.on(RoomEvent.LocalTrackUnpublished, (pub) => {
        if (pub.source === SCREEN) setNotice((n) => (SCREEN_NOTICES.includes(n) ? "" : n));
      });

      r.on(RoomEvent.TrackSubscribed, (track: RemoteTrack) => {
        if (track.kind === Track.Kind.Audio) {
          audioBox.current?.appendChild(track.attach());
          syncAudio();
        }
        refresh();
      });
      r.on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack) => {
        track.detach().forEach((el) => el.remove());
        refresh();
      });
      for (const ev of [
        RoomEvent.ParticipantConnected,
        RoomEvent.ParticipantDisconnected,
        RoomEvent.ActiveSpeakersChanged,
        RoomEvent.LocalTrackPublished,
        RoomEvent.LocalTrackUnpublished,
        RoomEvent.TrackMuted,
        RoomEvent.TrackUnmuted,
      ]) {
        r.on(ev, refresh);
      }

      // Aviso sonoro de quem entra e sai. A mesma pessoa trocando de dispositivo sai e entra
      // quase junto: o intervalo por pessoa evita tocar duas vezes.
      const lastCue = new Map<string, number>();
      const cue = (kind: "join" | "leave", identity: string) => {
        const { deaf: isDeaf, myId: me } = latest.current;
        const now = Date.now();
        if (identity === me || isDeaf || now - (lastCue.get(identity) ?? 0) < CUE_GAP_MS) return;
        lastCue.set(identity, now);
        playCue(kind);
      };
      r.on(RoomEvent.ParticipantConnected, (p) => cue("join", p.identity));
      r.on(RoomEvent.ParticipantDisconnected, (p) => cue("leave", p.identity));

      // Soundboard: chega só o id; cada um toca o arquivo daquele servidor no próprio aparelho.
      const lastSound = new Map<string, number>();
      r.on(RoomEvent.DataReceived, (payload, participant, _kind, topic) => {
        if (topic !== SOUND_TOPIC || !participant) return;
        const now = Date.now();
        if (now - (lastSound.get(participant.identity) ?? 0) < SOUND_RECEIVE_GAP_MS) return;
        let soundId: unknown;
        try {
          soundId = JSON.parse(new TextDecoder().decode(payload)).sound_id;
        } catch {
          return;
        }
        const { deaf: isDeaf, prefs: currentPrefs, sounds: list } = latest.current;
        const sound = list.find((s) => s.id === soundId);
        const person = personPrefs(currentPrefs, participant.identity);
        if (!sound || isDeaf || person.muted) return;
        lastSound.set(participant.identity, now);
        playSound(sound.url, currentPrefs.soundboardVolume * person.volume).catch((err) => console.error("[concord] som não tocou", err));
      });

      r.on(RoomEvent.AudioPlaybackStatusChanged, () => setAudioBlocked(!r.canPlaybackAudio));
      // ligar o microfone de novo depende da permissão nova ter chegado (silenciado para todos)
      r.on(RoomEvent.ParticipantPermissionsChanged, () => setPermissionsTick((n) => n + 1));
      r.on(RoomEvent.Disconnected, (reason) => {
        if (cancelled) return;
        // outro dispositivo entrou: só limpa a tela daqui. Mandar op 4 apagaria a sessão nova.
        if (reason === DisconnectReason.DUPLICATE_IDENTITY) latest.current.onReplaced();
        else setStatus("error");
      });
      r.on(RoomEvent.Reconnecting, () => setStatus("connecting"));
      r.on(RoomEvent.Reconnected, () => setStatus("connected"));

      try {
        await r.connect(creds.url, creds.token);
        if (cancelled) return r.disconnect();
        // o microfone liga no efeito abaixo; não espera o pedido de permissão do navegador
        setRoom(r);
        setStatus("connected");
        setAudioBlocked(!r.canPlaybackAudio);
        refresh();
      } catch (err) {
        console.error("[concord] voz não conectou", err);
        if (!cancelled) setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
      current?.disconnect();
      setRoom(null);
      setTiles([]);
      setCamera(false);
      setScreen(false);
      setAudioBlocked(false);
      setNotice("");
      setStatus("idle");
    };
  }, [audioBox, channelId, dm, sessionId]);

  // Fechar a página sai do canal na hora. Só ocultar não: trocar de aba ou minimizar não pode
  // derrubar uma chamada que está funcionando. Oculta e com a mídia já caída, aí sim sai.
  // Se o navegador matar a aba sem avisar, quem resolve é o webhook do LiveKit e a varredura.
  const inCall = !!channelId && !dm;
  useEffect(() => {
    if (!inCall) return;
    const onHidden = () => {
      if (document.visibilityState === "hidden" && latest.current.status === "error") sendVoiceLeaveBeacon();
    };
    window.addEventListener("pagehide", sendVoiceLeaveBeacon);
    document.addEventListener("visibilitychange", onHidden);
    return () => {
      window.removeEventListener("pagehide", sendVoiceLeaveBeacon);
      document.removeEventListener("visibilitychange", onHidden);
    };
  }, [inCall]);

  // microfone (o navegador pede permissão na primeira vez)
  const micOn = !muted && !serverMuted;
  useEffect(() => {
    if (!room) return;
    room.localParticipant.setMicrophoneEnabled(micOn).then(
      () => setMicBlocked(false),
      (err) => {
        console.error("[concord] microfone", err);
        setMicBlocked(micOn);
      },
    );
  }, [room, micOn, permissionsTick]);

  // fone, silêncio e volume por pessoa
  useEffect(() => {
    if (room) applyAudio(room, deaf, prefs);
  }, [room, deaf, prefs]);

  const toggleCamera = useCallback(async () => {
    if (!room) return false;
    const next = !room.localParticipant.isCameraEnabled;
    try {
      await room.localParticipant.setCameraEnabled(next);
      setCamera(next);
      return next;
    } catch (err) {
      setCamera(false);
      setNotice(`Não deu pra ligar a câmera: ${(err as Error).message}`);
      return false;
    }
  }, [room]);

  const toggleScreen = useCallback(async () => {
    if (!room) return false;
    const next = !room.localParticipant.isScreenShareEnabled;
    setNotice("");
    try {
      await room.localParticipant.setScreenShareEnabled(next, screenCaptureOptions(), SCREEN_AUDIO_PUBLISH);
    } catch (err) {
      setScreen(false);
      const e = err as DOMException;
      // cancelar a janela do navegador também chega como NotAllowedError, e não é erro
      const cancelled = e.name === "NotAllowedError" && !/system/i.test(e.message);
      if (!cancelled) {
        console.error("[concord] compartilhar tela", err);
        setNotice(`Não deu pra compartilhar a tela: ${e.message || e.name}`);
      }
      return false;
    }
    setScreen(next);
    if (next) {
      const local = room.localParticipant;
      const audio = local.getTrackPublication(SCREEN_AUDIO)?.track?.mediaStreamTrack;
      const video = local.getTrackPublication(SCREEN)?.track?.mediaStreamTrack;
      if (!audio) setNotice(SCREEN_NO_AUDIO_NOTICE);
      else {
        if (video?.getSettings().displaySurface === "monitor" && !canRestrictOwnAudio()) setNotice(SCREEN_ECHO_NOTICE);
        // encerrar a captura inteira também termina o áudio: só avisa se a imagem continuar
        audio.addEventListener(
          "ended",
          () => setTimeout(() => video?.readyState === "live" && setNotice(SCREEN_AUDIO_ENDED_NOTICE)),
          { once: true },
        );
      }
    }
    return next;
  }, [room]);

  const startAudio = useCallback(async () => {
    unlockAudio();
    await room?.startAudio().catch((err) => console.error("[concord] áudio bloqueado", err));
    if (room) setAudioBlocked(!room.canPlaybackAudio);
  }, [room]);

  const sendSound = useCallback(
    async (sound: ApiSound) => {
      if (!room || Date.now() - lastSent.current < SOUND_COOLDOWN_MS) return;
      lastSent.current = Date.now();
      setCooling(true);
      setTimeout(() => setCooling(false), SOUND_COOLDOWN_MS);
      const { deaf: isDeaf, prefs: currentPrefs } = latest.current;
      if (!isDeaf) playSound(sound.url, currentPrefs.soundboardVolume).catch((err) => console.error("[concord] som não tocou", err));
      try {
        await room.localParticipant.publishData(new TextEncoder().encode(JSON.stringify({ sound_id: sound.id })), {
          reliable: true,
          topic: SOUND_TOPIC,
        });
      } catch (err) {
        console.error("[concord] soundboard", err);
        setNotice("Você não tem permissão pra tocar sons neste canal.");
      }
    },
    [room],
  );

  return {
    status,
    tiles,
    camera,
    screen,
    micBlocked,
    audioBlocked,
    notice,
    cooling,
    clearNotice: () => setNotice(""),
    toggleCamera,
    toggleScreen,
    startAudio,
    sendSound,
  };
}
