import { requireAuth } from "@/lib/server/auth";
import { assertNoBlock, requireDmParticipant } from "@/lib/server/dmCalls";
import { dispatch } from "@/lib/server/events";
import { Errors, json, readJson, route } from "@/lib/server/http";
import { limit } from "@/lib/server/ratelimit";
import { serializeUser, sid } from "@/lib/server/serialize";
import { snowflake } from "@/lib/server/snowflake";
import { Form } from "@/lib/server/validate";

const EVENTS = { accept: "CALL_ACCEPT", decline: "CALL_DECLINE", end: "CALL_END" } as const;

// POST /api/v1/voice/dm-call { action: ring | accept | decline | end, channel_id, call_id? }
// Sinal de chamada entre os participantes da DM, pela fila normal de eventos. Nada fica gravado:
// o toque expira no próprio cliente. "at" é o horário do servidor, igual para todo mundo.
export const POST = route(async (req) => {
  const { user } = await requireAuth(req);
  await limit("dmCall", user.id);

  const form = new Form(await readJson(req));
  const action = form.string("action", { pattern: /^(ring|accept|decline|end)$/ });
  const channelId = form.snowflake("channel_id");
  const callId = form.snowflake("call_id");
  form.done();
  if (channelId == null) throw Errors.badRequest("channel_id is required");

  const channel = await requireDmParticipant(channelId, user.id);
  const at = Date.now();
  const scope = { channelId: channel.id };

  if (action === "ring") {
    await assertNoBlock(channel, user.id);
    const id = snowflake();
    await dispatch("CALL_RING", { call_id: sid(id), channel_id: sid(channel.id), caller: serializeUser(user), at }, scope);
    return json({ call_id: sid(id), at });
  }

  const id = callId ?? snowflake();
  await dispatch(EVENTS[action as keyof typeof EVENTS], { call_id: sid(id), channel_id: sid(channel.id), user_id: sid(user.id), at }, scope);
  return json({ call_id: sid(id), at });
});
