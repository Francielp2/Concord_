import { randomBytes } from "node:crypto";
import { requireAuth } from "@/lib/server/auth";
import { loadChannelContext } from "@/lib/server/access";
import { db } from "@/lib/server/db";
import { dispatch } from "@/lib/server/events";
import { HEARTBEAT_INTERVAL_MS, Op } from "@/lib/server/gateway";
import { ApiError, Errors, json, readJson, route } from "@/lib/server/http";
import { maybeSweepVoice } from "@/lib/server/maintenance";
import { Permissions, has } from "@/lib/server/permissions";
import { PRESENCE_STATUSES, setPresenceStatus, touchPresence } from "@/lib/server/presence";
import { serializePresence, serializeVoiceState } from "@/lib/server/serialize";
import { Form } from "@/lib/server/validate";
import { removeVoiceState } from "@/lib/server/voice";

const SESSION_ID = /^[A-Za-z0-9_-]{8,64}$/;

// GET /api/v1/gateway: onde conectar (equivalente ao GET /gateway do Discord)
export const GET = route(async () =>
  json({
    url: "/api/v1/gateway/connect",
    transport: "sse",
    heartbeat_interval: HEARTBEAT_INTERVAL_MS,
  }),
);

// POST /api/v1/gateway: opcodes enviados pelo cliente
export const POST = route(async (req) => {
  const { user } = await requireAuth(req);
  const body = await readJson(req);
  const d = (body.d && typeof body.d === "object" ? body.d : {}) as Record<string, unknown>;

  switch (body.op) {
    case Op.HEARTBEAT: {
      // heartbeat de voz: vem só do dispositivo que está na chamada
      if (typeof d.voice_session_id === "string") {
        const { count } = await db.voiceState.updateMany({
          where: { userId: user.id, sessionId: d.voice_session_id },
          data: { lastSeenAt: new Date() },
        });
        await maybeSweepVoice();
        return json({ op: Op.HEARTBEAT_ACK, d: { voice: count > 0 } });
      }
      await touchPresence(user.id);
      return json({ op: Op.HEARTBEAT_ACK, d: null });
    }

    case Op.PRESENCE_UPDATE: {
      const form = new Form(d);
      const status = form.string("status", { pattern: new RegExp(`^(${PRESENCE_STATUSES.join("|")})$`) });
      const custom = form.optionalString("custom_status", { max: 128 });
      form.done();
      const presence = await setPresenceStatus(user.id, status!, custom === "" ? null : custom);
      return json({ op: Op.DISPATCH, t: "PRESENCE_UPDATE", d: serializePresence(presence) });
    }

    case Op.VOICE_STATE_UPDATE: {
      const form = new Form(d);
      const guildId = form.snowflake("guild_id");
      const channelId = form.snowflake("channel_id");
      const selfMute = form.bool("self_mute") ?? false;
      const selfDeaf = form.bool("self_deaf") ?? false;
      const sessionId = form.optionalString("session_id", { pattern: SESSION_ID });
      form.done();

      const previous = await db.voiceState.findUnique({ where: { userId: user.id } });

      if (channelId == null) {
        // com session_id, sair só vale para esse dispositivo: o antigo fechando a aba não derruba o novo
        const payload = await removeVoiceState({ userId: user.id, ...(sessionId ? { sessionId } : {}) });
        return json({ op: Op.DISPATCH, t: "VOICE_STATE_UPDATE", d: payload });
      }

      const ctx = await loadChannelContext(channelId, user.id);
      if (ctx.channel.type !== 2 || ctx.channel.guildId == null) throw Errors.invalidChannelType();
      if (guildId != null && guildId !== ctx.channel.guildId) throw Errors.badRequest("guild_id does not match channel");
      if (!has(ctx.permissions, Permissions.CONNECT)) throw Errors.missingPermissions();

      const limit = ctx.channel.userLimit ?? 0;
      if (limit > 0 && previous?.channelId !== channelId) {
        const inside = await db.voiceState.count({ where: { channelId } });
        if (inside >= limit && !has(ctx.permissions, Permissions.MOVE_MEMBERS)) {
          throw new ApiError(403, 50013, "Voice channel is full");
        }
      }

      // trocou de guild: sai da anterior
      if (previous && previous.guildId !== ctx.channel.guildId) {
        await dispatch("VOICE_STATE_UPDATE", { ...serializeVoiceState(previous), channel_id: null }, { guildId: previous.guildId });
      }

      // o último dispositivo a entrar vence: a sessão dele substitui a anterior
      const session = sessionId ?? previous?.sessionId ?? randomBytes(16).toString("hex");
      const lastSeenAt = new Date();
      const state = await db.voiceState.upsert({
        where: { userId: user.id },
        create: { userId: user.id, guildId: ctx.channel.guildId, channelId, selfMute, selfDeaf, sessionId: session, lastSeenAt },
        update: { guildId: ctx.channel.guildId, channelId, selfMute, selfDeaf, sessionId: session, lastSeenAt },
      });
      const payload = serializeVoiceState(state);
      await dispatch("VOICE_STATE_UPDATE", payload, { guildId: state.guildId });
      return json({ op: Op.DISPATCH, t: "VOICE_STATE_UPDATE", d: payload });
    }

    default:
      throw new ApiError(400, 4001, "Unknown opcode");
  }
});
