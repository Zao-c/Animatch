/** Run on the trusted server. Share the printed code privately after verifying the account owner. */
import { randomBytes } from "node:crypto";
import { prisma } from "../src/lib/db";
import { recoveryDigest } from "../src/lib/password";
async function main() {
  const username = process.argv[2]?.trim().normalize("NFKC").toLowerCase();
  if (!username) throw new Error("Usage: tsx scripts/issue-account-recovery.ts <username>");
  const code = randomBytes(24).toString("base64url");
  await prisma.user.update({ where: { username, deletedAt: null }, data: { recoveryHash: recoveryDigest(code), recoveryExpiresAt: new Date(Date.now() + 3600_000) } });
  console.log(`账号：${username}\n一次性恢复码（1 小时内有效）：${code}\n请核实账号所有者后私下发送。`);
}
main().catch((e) => { console.error(e.message); process.exitCode = 1; }).finally(() => prisma.$disconnect());
