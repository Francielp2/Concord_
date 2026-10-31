import { db } from "./db";
import { dispatch } from "./events";
import { serializeSound, soundSelect } from "./guilds";
import { sid } from "./serialize";

export const SOUND_NAME = /^[\p{L}\p{N} _-]{2,32}$/u;
export const MAX_SOUND_BYTES = 300 * 1024;
export const MAX_SOUND_MS = 5000;
export const MAX_SOUNDS = 30;

export function soundExtension(type: string) {
  return { "audio/mpeg": "mp3", "audio/ogg": "ogg", "audio/wav": "wav", "audio/webm": "webm", "audio/mp4": "m4a" }[type] ?? "bin";
}

export async function broadcastSounds(guildId: bigint) {
  const sounds = await db.sound.findMany({ where: { guildId }, select: soundSelect, orderBy: { name: "asc" } });
  await dispatch("GUILD_SOUNDS_UPDATE", { guild_id: sid(guildId), sounds: sounds.map(serializeSound) }, { guildId });
}
