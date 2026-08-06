import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  // Example: Creating Brands
  const hushPuppies = await prisma.brand.upsert({
    where: { name: 'Hush Puppies' },
    update: {},
    create: { name: 'Hush Puppies' },
  });

  const nicole = await prisma.brand.upsert({
    where: { name: 'Nicole' },
    update: {},
    create: { name: 'Nicole' },
  });

  const obermain = await prisma.brand.upsert({
    where: { name: 'Obermain' },
    update: {},
    create: { name: 'Obermain' },
  });

  // Example: Inserting Real Products with actual SKUs
  await prisma.product.upsert({
    where: { sku: '42221361593' },
    update: {},
    create: {
      sku: '42221361593',
      name: "Hush Puppies Men's Premium Leather Bi-fold Wallet",
      brandId: hushPuppies.id,
    },
  });

  console.log('Real product catalog seeded successfully.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });