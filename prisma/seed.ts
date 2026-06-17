import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seed complete — no seed data needed for Midnight AI.');
  console.log('Users are auto-created on first Telegram interaction.');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
