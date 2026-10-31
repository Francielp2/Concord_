// Rodar uma vez depois de subir o soundboard: `npm run db:backfill-soundboard`.
// Servidores novos já nascem com USE_SOUNDBOARD no @everyone; os que já existiam não têm o bit,
// e sem ele só o dono e os administradores conseguem tocar sons. É seguro rodar de novo.
import { PrismaClient } from "@prisma/client";

const USE_SOUNDBOARD = BigInt(1) << BigInt(42);
const db = new PrismaClient();

try {
  // o cargo @everyone tem o mesmo id da guild
  const count = await db.$executeRaw`UPDATE Role SET permissions = permissions | ${USE_SOUNDBOARD} WHERE id = guildId`;
  console.log(`@everyone atualizado em ${count} servidor(es).`);
} finally {
  await db.$disconnect();
}
