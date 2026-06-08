import { prisma } from "./db";

export async function getOrCreateDevUser() {
  return prisma.user.upsert({
    where: {
      email: "dev@animatch.local"
    },
    create: {
      email: "dev@animatch.local",
      name: "AniMatch Dev User",
      username: "dev"
    },
    update: {}
  });
}
