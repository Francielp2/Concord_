import { db } from "./db";
import { ApiError, Errors } from "./http";
import { isBlockedBetween } from "./relationships";

export const DM_SESSION_ID = /^[A-Za-z0-9_-]{8,64}$/;

// A conversa, se a pessoa participa dela. Chamada de DM não tem nada no banco além disso.
export async function requireDmParticipant(channelId: bigint, userId: bigint) {
  const channel = await db.channel.findUnique({ where: { id: channelId }, include: { recipients: true } });
  if (!channel || (channel.type !== 1 && channel.type !== 3) || !channel.recipients.some((r) => r.userId === userId)) {
    throw Errors.unknownChannel();
  }
  return channel;
}

export async function assertNoBlock(channel: { recipients: { userId: bigint }[] }, userId: bigint) {
  const others = channel.recipients.filter((r) => r.userId !== userId);
  const blocked = await Promise.all(others.map((r) => isBlockedBetween(userId, r.userId)));
  if (blocked.some(Boolean)) throw new ApiError(403, 50007, "Cannot call this user");
}
