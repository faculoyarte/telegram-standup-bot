const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

console.log('DATABASE_URL:', process.env.DATABASE_URL);

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  // Create sample users
  await prisma.user.createMany({
    data: [
      { name: 'John Doe', email: 'john@example.com', department: 'engineering', telegramUserId: '12345' },
      { name: 'Jane Smith', email: 'jane@example.com', department: 'marketing', telegramUserId: '67890' },
    ],
  });

  // Create a sample task
  await prisma.task.create({
    data: {
      title: 'Fix homepage bug',
      description: 'Fix the alignment issue on the homepage header.',
      creatorId: 1, // Ensure this ID exists in the User table
      status: 'NOT_STARTED',
      priority: 0,
      timeEstimate: 3,
      timeScale: 'HOURS',
      why: 'Critical bug impacting user experience',
    },
  });

  console.log('Seeding complete!');
}

main()
  .catch((e) => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
