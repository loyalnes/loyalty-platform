import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  // Clean existing data
  await prisma.pointsTransaction.deleteMany();
  await prisma.loyaltyCard.deleteMany();
  await prisma.cardTemplate.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.merchant.deleteMany();

  // Create merchants
  const cafe = await prisma.merchant.create({
    data: {
      name: "Bean & Brew Café",
      email: "hello@beanandbrew.com",
      phone: "+1-555-0101",
      address: "42 Main Street",
      city: "Portland",
      country: "US",
      plan: "STARTER",
      settings: { currency: "USD", timezone: "America/Los_Angeles" },
    },
  });

  const restaurant = await prisma.merchant.create({
    data: {
      name: "Trattoria Roma",
      email: "info@trattoriaroma.com",
      phone: "+1-555-0202",
      address: "88 Oak Avenue",
      city: "San Francisco",
      country: "US",
      plan: "PROFESSIONAL",
      settings: { currency: "USD", timezone: "America/Los_Angeles" },
    },
  });

  // Create card templates
  const cafeStandard = await prisma.cardTemplate.create({
    data: {
      merchantId: cafe.id,
      name: "Coffee Lover",
      description: "Earn 1 point per dollar spent on drinks",
      tier: "STANDARD",
      pointsPerCurrency: 1,
      redemptionRate: 0.01,
      minRedeemPoints: 50,
      bonusMultiplier: 1,
      validityDays: 365,
    },
  });

  const cafeGold = await prisma.cardTemplate.create({
    data: {
      merchantId: cafe.id,
      name: "Gold Bean",
      description: "Premium tier — 2x points on all purchases",
      tier: "GOLD",
      pointsPerCurrency: 2,
      redemptionRate: 0.02,
      minRedeemPoints: 25,
      bonusMultiplier: 2,
      validityDays: 730,
    },
  });

  const restaurantStandard = await prisma.cardTemplate.create({
    data: {
      merchantId: restaurant.id,
      name: "Amici Card",
      description: "Earn points on every meal",
      tier: "STANDARD",
      pointsPerCurrency: 1.5,
      redemptionRate: 0.015,
      minRedeemPoints: 100,
      bonusMultiplier: 1,
    },
  });

  // Create customers
  const alice = await prisma.customer.create({
    data: {
      email: "alice@example.com",
      firstName: "Alice",
      lastName: "Johnson",
      phone: "+1-555-1001",
    },
  });

  const bob = await prisma.customer.create({
    data: {
      email: "bob@example.com",
      firstName: "Bob",
      lastName: "Martinez",
      phone: "+1-555-1002",
    },
  });

  // Create loyalty cards
  const aliceCafeCard = await prisma.loyaltyCard.create({
    data: {
      cardNumber: "BB-2026-0001",
      merchantId: cafe.id,
      customerId: alice.id,
      cardTemplateId: cafeGold.id,
      pointsBalance: 240,
      totalEarned: 340,
      totalRedeemed: 100,
    },
  });

  const bobCafeCard = await prisma.loyaltyCard.create({
    data: {
      cardNumber: "BB-2026-0002",
      merchantId: cafe.id,
      customerId: bob.id,
      cardTemplateId: cafeStandard.id,
      pointsBalance: 75,
      totalEarned: 75,
      totalRedeemed: 0,
    },
  });

  const aliceRestaurantCard = await prisma.loyaltyCard.create({
    data: {
      cardNumber: "TR-2026-0001",
      merchantId: restaurant.id,
      customerId: alice.id,
      cardTemplateId: restaurantStandard.id,
      pointsBalance: 450,
      totalEarned: 450,
      totalRedeemed: 0,
    },
  });

  // Create points transactions
  await prisma.pointsTransaction.createMany({
    data: [
      {
        loyaltyCardId: aliceCafeCard.id,
        type: "EARN",
        points: 200,
        balanceAfter: 200,
        description: "Purchase — 2x Gold Bean bonus",
      },
      {
        loyaltyCardId: aliceCafeCard.id,
        type: "EARN",
        points: 140,
        balanceAfter: 340,
        description: "Purchase — 2x Gold Bean bonus",
      },
      {
        loyaltyCardId: aliceCafeCard.id,
        type: "REDEEM",
        points: -100,
        balanceAfter: 240,
        description: "Redeemed for free latte",
      },
      {
        loyaltyCardId: bobCafeCard.id,
        type: "EARN",
        points: 75,
        balanceAfter: 75,
        description: "Purchase",
      },
      {
        loyaltyCardId: aliceRestaurantCard.id,
        type: "EARN",
        points: 300,
        balanceAfter: 300,
        description: "Dinner for two",
      },
      {
        loyaltyCardId: aliceRestaurantCard.id,
        type: "BONUS",
        points: 150,
        balanceAfter: 450,
        description: "Welcome bonus",
      },
    ],
  });

  console.log("Seed complete:");
  console.log(`  Merchants: ${cafe.name}, ${restaurant.name}`);
  console.log(`  Templates: ${cafeStandard.name}, ${cafeGold.name}, ${restaurantStandard.name}`);
  console.log(`  Customers: ${alice.firstName} ${alice.lastName}, ${bob.firstName} ${bob.lastName}`);
  console.log(`  Loyalty cards: 3`);
  console.log(`  Transactions: 6`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
