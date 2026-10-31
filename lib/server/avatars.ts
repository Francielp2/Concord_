import { db } from "./db";
import { Rel } from "./relationships";
import { parseSnowflake } from "./snowflake";
import { removeFiles } from "./storage";

export const AVATAR_MAX_BYTES = 4 * 1024 * 1024;
export const INTERNAL_ASSET_PREFIX = "/api/v1/guild-assets/";

// Apaga a foto que acabou de ser trocada, se era um arquivo enviado aqui. Link externo antigo fica como está.
export async function removeOldAvatar(userId: bigint, url: string) {
  if (url.startsWith(INTERNAL_ASSET_PREFIX)) {
    const id = parseSnowflake(url.slice(INTERNAL_ASSET_PREFIX.length));
    if (id == null) return;
    // o GuildAsset não guarda dono, e qualquer um pode apontar a foto para ele: só some se ninguém mais usa
    const [guilds, users] = await Promise.all([
      db.guild.count({ where: { OR: [{ icon: url }, { banner: url }] } }),
      db.user.count({ where: { avatar: url } }),
    ]);
    if (!guilds && !users) await db.guildAsset.deleteMany({ where: { id } });
    return;
  }
  // no Blob, só o que está na pasta desta conta
  try {
    const { hostname, pathname } = new URL(url);
    if (hostname.endsWith(".blob.vercel-storage.com") && pathname.startsWith(`/avatars/${userId}/`)) await removeFiles([url]);
  } catch {}
}

// Quem mais precisa saber da foto nova sem dividir servidor: amigos, pedidos pendentes e conversas diretas.
export async function profileWatchers(userId: bigint) {
  const [rels, dms] = await Promise.all([
    db.relationship.findMany({
      where: { targetId: userId, type: { in: [Rel.FRIEND, Rel.INCOMING, Rel.OUTGOING] } },
      select: { userId: true },
    }),
    db.channelRecipient.findMany({
      where: { userId: { not: userId }, channel: { recipients: { some: { userId } } } },
      select: { userId: true },
    }),
  ]);
  return [...rels, ...dms].map((r) => r.userId);
}
