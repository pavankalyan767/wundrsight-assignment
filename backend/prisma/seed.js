// File: backend/prisma/seed.js

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('Start seeding...');

  // Seed an admin user
  const adminPassword = await bcrypt.hash('adminpass', 10);
  await prisma.user.upsert({
    where: { email: 'admin@wundrsight.com' },
    update: {},
    create: {
      name: 'Admin User',
      email: 'admin@wundrsight.com',
      password_hash: adminPassword,
      role: 'admin',
    },
  });
  console.log('Admin user seeded.');

  // Seed time slots
  const slots = [];
  const today = new Date();
  today.setHours(9, 0, 0, 0); // Start at 9 AM

  for (let i = 0; i < 7 * 8; i++) { // 7 days, 8 slots per day
    const start_at = new Date(today);
    start_at.setMinutes(today.getMinutes() + i * 30);

    const end_at = new Date(start_at);
    end_at.setMinutes(start_at.getMinutes() + 30);

    // Skip lunch break from 12:30 to 13:30
    if (start_at.getHours() === 12 && start_at.getMinutes() >= 30) {
      today.setHours(13, 30, 0, 0); // Jump past lunch
      continue;
    }

    slots.push({ start_at, end_at });
  }

  await prisma.slot.createMany({
    data: slots,
    skipDuplicates: true,
  });
  console.log('Time slots seeded.');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });