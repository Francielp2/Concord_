import type { Guild } from "@prisma/client";
import { db } from "./db";
import { removeFiles } from "./storage";

export const ASSET_LIMITS = {
  icon: 1024 * 1024,
  banner: 4 * 1024 * 1024,
} as const;

export type AssetKind = keyof typeof ASSET_LIMITS;

const ORPHAN_MS = 60 * 60 * 1000;

export const assetUrl = (a: { id: bigint; url: string | null }) => a.url ?? `/api/v1/guild-assets/${a.id}`;

export async function guildAssetUrls(guildId: bigint) {
  const assets = await db.guildAsset.findMany({ where: { guildId }, select: { id: true, url: true } });
  return assets.map(assetUrl);
}

// Apaga a imagem que acabou de ser trocada e as que subiram mas nunca foram salvas.
// As recém-enviadas ficam: outro administrador pode estar no meio de salvar a dele.
export async function cleanupGuildAssets(guild: Pick<Guild, "id" | "icon" | "banner">, replaced: (string | null)[]) {
  const assets = await db.guildAsset.findMany({ where: { guildId: guild.id }, select: { id: true, url: true, createdAt: true } });
  const before = Date.now() - ORPHAN_MS;
  const stale = assets.filter((a) => {
    const url = assetUrl(a);
    if (url === guild.icon || url === guild.banner) return false;
    return replaced.includes(url) || a.createdAt.getTime() < before;
  });
  if (!stale.length) return;
  // sem Blob, a foto de perfil também mora nesta tabela: em uso, ela não é órfã
  const inDatabase = stale.filter((a) => !a.url).map(assetUrl);
  const avatars = inDatabase.length ? await db.user.findMany({ where: { avatar: { in: inDatabase } }, select: { avatar: true } }) : [];
  const inUse = new Set(avatars.map((u) => u.avatar));
  const removable = stale.filter((a) => !inUse.has(assetUrl(a)));
  if (!removable.length) return;
  await removeFiles(removable.map((a) => a.url));
  await db.guildAsset.deleteMany({ where: { id: { in: removable.map((a) => a.id) } } });
}
