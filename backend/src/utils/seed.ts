import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seed() {
  console.log('🌱 Seeding database...');

  // Create admin user
  const admin = await prisma.user.create({
    data: {
      email: 'admin@adcity.com',
      username: 'admin',
      passwordHash: '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.VTtYA.qGZvKG6', // admin123
      displayName: 'Administrator',
      role: 'ADMIN',
    },
  });

  await prisma.wallet.create({
    data: {
      userId: admin.id,
      balance: 1000000,
    },
  });

  // Create demo user
  const demo = await prisma.user.create({
    data: {
      email: 'demo@adcity.com',
      username: 'demo',
      passwordHash: '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.VTtYA.qGZvKG6', // demo123
      displayName: 'Demo User',
    },
  });

  await prisma.wallet.create({
    data: {
      userId: demo.id,
      balance: 500000,
    },
  });

  // Create billboards
  const billboards = [
    // Premium main road billboards
    {
      name: 'Billboard #101',
      type: 'PREMIUM' as const,
      positionX: 0, positionY: 3, positionZ: -30,
      rotationY: 0,
      width: 6, height: 3.5,
      location: 'Main Road - Central Plaza',
      trafficRadius: 80,
      trafficRating: 'VERY_HIGH' as const,
      visibilityRating: 'EXCELLENT' as const,
      minBid: 50000,
      isAvailable: true,
    },
    {
      name: 'Billboard #102',
      type: 'PREMIUM' as const,
      positionX: 40, positionY: 3, positionZ: 0,
      rotationY: -Math.PI / 2,
      width: 6, height: 3.5,
      location: 'Main Road - East Junction',
      trafficRadius: 70,
      trafficRating: 'VERY_HIGH' as const,
      visibilityRating: 'EXCELLENT' as const,
      minBid: 45000,
      isAvailable: true,
    },
    {
      name: 'Billboard #103',
      type: 'PREMIUM' as const,
      positionX: -40, positionY: 3, positionZ: 0,
      rotationY: Math.PI / 2,
      width: 6, height: 3.5,
      location: 'Main Road - West Junction',
      trafficRadius: 65,
      trafficRating: 'HIGH' as const,
      visibilityRating: 'EXCELLENT' as const,
      minBid: 40000,
      isAvailable: true,
    },
    {
      name: 'Billboard #104',
      type: 'PREMIUM' as const,
      positionX: 0, positionY: 3, positionZ: 30,
      rotationY: Math.PI,
      width: 6, height: 3.5,
      location: 'Main Road - South Plaza',
      trafficRadius: 75,
      trafficRating: 'VERY_HIGH' as const,
      visibilityRating: 'EXCELLENT' as const,
      minBid: 48000,
      isAvailable: true,
    },
    // Street billboards
    {
      name: 'Billboard #201',
      type: 'STREET' as const,
      positionX: 15, positionY: 2.5, positionZ: -15,
      rotationY: -Math.PI / 4,
      width: 3, height: 2,
      location: 'Side Street - North East',
      trafficRadius: 40,
      trafficRating: 'MEDIUM' as const,
      visibilityRating: 'GOOD' as const,
      minBid: 5000,
      isAvailable: true,
    },
    {
      name: 'Billboard #202',
      type: 'STREET' as const,
      positionX: -15, positionY: 2.5, positionZ: 15,
      rotationY: Math.PI * 0.75,
      width: 3, height: 2,
      location: 'Side Street - South West',
      trafficRadius: 35,
      trafficRating: 'MEDIUM' as const,
      visibilityRating: 'GOOD' as const,
      minBid: 4500,
      isAvailable: true,
    },
    {
      name: 'Billboard #203',
      type: 'STREET' as const,
      positionX: 25, positionY: 2.5, positionZ: 25,
      rotationY: -Math.PI * 0.75,
      width: 3, height: 2,
      location: 'Side Street - South East',
      trafficRadius: 30,
      trafficRating: 'LOW' as const,
      visibilityRating: 'FAIR' as const,
      minBid: 3000,
      isAvailable: true,
    },
    {
      name: 'Billboard #204',
      type: 'STREET' as const,
      positionX: -25, positionY: 2.5, positionZ: -25,
      rotationY: Math.PI / 4,
      width: 3, height: 2,
      location: 'Side Street - North West',
      trafficRadius: 35,
      trafficRating: 'MEDIUM' as const,
      visibilityRating: 'GOOD' as const,
      minBid: 4000,
      isAvailable: true,
    },
    {
      name: 'Billboard #205',
      type: 'STREET' as const,
      positionX: 10, positionY: 2.5, positionZ: 35,
      rotationY: Math.PI,
      width: 3, height: 2,
      location: 'Residential Street - South',
      trafficRadius: 25,
      trafficRating: 'LOW' as const,
      visibilityRating: 'FAIR' as const,
      minBid: 2500,
      isAvailable: true,
    },
    {
      name: 'Billboard #206',
      type: 'STREET' as const,
      positionX: -10, positionY: 2.5, positionZ: -35,
      rotationY: 0,
      width: 3, height: 2,
      location: 'Residential Street - North',
      trafficRadius: 25,
      trafficRating: 'LOW' as const,
      visibilityRating: 'FAIR' as const,
      minBid: 2500,
      isAvailable: true,
    },
  ];

  for (const b of billboards) {
    await prisma.billboard.create({ data: b });
  }

  // Create sample auction
  const billboard = await prisma.billboard.findFirst({ where: { name: 'Billboard #101' } });
  if (billboard) {
    await prisma.auction.create({
      data: {
        billboardId: billboard.id,
        startPrice: 50000,
        currentPrice: 500000,
        endsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    await prisma.billboard.update({
      where: { id: billboard.id },
      data: {
        currentBid: 500000,
        currentBidderId: demo.id,
        isAvailable: false,
      },
    });
  }

  // Create sample advertisement
  const ad = await prisma.advertisement.create({
    data: {
      userId: demo.id,
      title: 'Summer Sale 2026',
      description: 'Get up to 50% off on all products',
      imageUrl: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=800',
      targetUrl: 'https://example.com',
      status: 'APPROVED',
    },
  });

  // Create sample campaign
  if (billboard) {
    await prisma.advertisingCampaign.create({
      data: {
        userId: demo.id,
        billboardId: billboard.id,
        advertisementId: ad.id,
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        isActive: true,
      },
    });
  }

  console.log('✅ Seed completed');
}

seed()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
