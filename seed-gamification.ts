import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding gamification test data...");

  // Create test merchant
  const passwordHash = await bcrypt.hash("test123", 10);

  const merchant = await prisma.merchant.upsert({
    where: { email: "test@cafe.com" },
    update: {},
    create: {
      name: "Test Café",
      email: "test@cafe.com",
      passwordHash,
      plan: "FREE",
      settings: "{}",
    },
  });

  console.log(`✓ Created merchant: ${merchant.name} (${merchant.id})`);

  // Create gamification campaign
  const campaign = await prisma.gamificationCampaign.create({
    data: {
      merchantId: merchant.id,
      name: "Welcome Spring Campaign",
      description: "Scratch and win amazing prizes!",
      gameType: "SCRATCH_CARD",
      active: true,
      prizes: {
        create: [
          {
            name: "Free Coffee",
            description: "One free coffee of your choice",
            prizeType: "PHYSICAL",
            probability: 50,
            validityDays: 7,
          },
          {
            name: "Free Cookie",
            description: "One delicious cookie",
            prizeType: "PHYSICAL",
            probability: 30,
            validityDays: 7,
          },
          {
            name: "10% Discount",
            description: "10% off your next purchase",
            prizeType: "DIGITAL",
            prizeValue: "10",
            probability: 20,
            validityDays: 14,
          },
        ],
      },
    },
    include: {
      prizes: true,
    },
  });

  console.log(`✓ Created campaign: ${campaign.name}`);
  console.log(`  - Prizes: ${campaign.prizes.length}`);
  campaign.prizes.forEach((prize) => {
    console.log(`    • ${prize.name} (weight: ${prize.probability})`);
  });

  console.log(`\n🎮 Test URLs:`);
  console.log(`   Dashboard: http://localhost:3000/dashboard`);
  console.log(`   Login: test@cafe.com / test123`);
  console.log(`   Play game: http://localhost:3000/app/play/${merchant.id}`);
  console.log(`\n✅ Seed complete!`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
