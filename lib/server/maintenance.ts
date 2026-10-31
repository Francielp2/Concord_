import { db } from "./db";
import { PRESENCE_TIMEOUT_MS, broadcastPresence } from "./presence";
import { removeFiles } from "./storage";
import { sweepVoice } from "./voice";

const SWEEP_INTERVAL_MS = 30_000;
export const VOICE_SWEEP_INTERVAL_MS = 10_000;
const EVENT_RETENTION_MS = 24 * 60 * 60 * 1000;
const ORPHAN_ATTACHMENT_MS = 60 * 60 * 1000;

// Na Vercel não existe processo de fundo. Quem estiver com o gateway aberto
// tenta pegar esta trava periodicamente; só um consegue e faz a varredura.
async function acquireLock(key: string, intervalMs: number, now: Date) {
  const acquired = await db.systemLock.updateMany({
    where: { key, at: { lt: new Date(now.getTime() - intervalMs) } },
    data: { at: now },
  });
  if (acquired.count > 0) return true;
  const exists = await db.systemLock.findUnique({ where: { key } });
  if (exists) return false;
  try {
    await db.systemLock.create({ data: { key, at: now } });
    return true;
  } catch {
    return false; // outro processo criou ao mesmo tempo
  }
}

export async function maybeSweep(force = false) {
  const now = new Date();
  if (!force && !(await acquireLock("sweep", SWEEP_INTERVAL_MS, now))) return false;
  await sweep(now);
  return true;
}

// Trava própria e bem mais frequente: com a varredura geral de 30s,
// o timeout de voz não faria diferença.
export async function maybeSweepVoice() {
  const now = new Date();
  if (!(await acquireLock("voice-sweep", VOICE_SWEEP_INTERVAL_MS, now))) return false;
  await sweepVoice(now);
  return true;
}

async function sweep(now: Date) {
  const staleBefore = new Date(now.getTime() - PRESENCE_TIMEOUT_MS);

  // 1. Quem parou de mandar heartbeat fica offline
  const stale = await db.presence.findMany({
    where: { online: true, lastSeenAt: { lt: staleBefore } },
    select: { userId: true },
    take: 500,
  });
  if (stale.length) {
    const ids = stale.map((s) => s.userId);
    await db.presence.updateMany({
      where: { userId: { in: ids }, lastSeenAt: { lt: staleBefore } },
      data: { online: false },
    });
    for (const id of ids) await broadcastPresence(id);
  }

  // 2. Voz fantasma (por dispositivo, independente da presença)
  await sweepVoice(now);

  // 3. Limpa a fila de eventos antiga (RESUME além disso vira INVALID_SESSION)
  await db.gatewayEvent.deleteMany({ where: { createdAt: { lt: new Date(now.getTime() - EVENT_RETENTION_MS) } } });

  // 4. Convites vencidos
  await db.invite.deleteMany({ where: { expiresAt: { lt: now } } });

  // 5. Anexos que subiram mas nunca foram numa mensagem
  const orphans = await db.attachment.findMany({
    where: { messageId: null, createdAt: { lt: new Date(now.getTime() - ORPHAN_ATTACHMENT_MS) } },
    select: { id: true, url: true },
    take: 500,
  });
  if (orphans.length) {
    await removeFiles(orphans.map((o) => o.url));
    await db.attachment.deleteMany({ where: { id: { in: orphans.map((o) => o.id) } } });
  }

  // 6. Janelas de limite vencidas e tokens de e-mail usados/vencidos
  await db.rateLimit.deleteMany({ where: { resetAt: { lt: now } } });
  await db.authToken.deleteMany({ where: { expiresAt: { lt: now } } });
}
