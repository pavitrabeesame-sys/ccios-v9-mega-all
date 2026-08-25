import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const mappings = [
    // SHOPEE
    {
      marketplace: 'SHOPEE',
      storeId: '1000055891',
      brandName: 'RAV',
    },
    {
      marketplace: 'SHOPEE',
      storeId: '100164017',
      brandName: 'Nicole',
    },
    {
      marketplace: 'SHOPEE',
      storeId: '300749392344',
      brandName: 'OBERMAIN',
    },
    {
      marketplace: 'SHOPEE',
      storeId: '300763632066',
      brandName: 'Hush Puppies',
    },
    {
      marketplace: 'SHOPEE',
      storeId: '300934544102',
      brandName: 'Beverly Hills Polo Club',
    },

    // LAZADA
    {
      marketplace: 'LAZADA',
      storeId: '1000055891',
      brandName: 'RAV',
    },
    {
      marketplace: 'LAZADA',
      storeId: '100164017',
      brandName: 'Nicole',
    },
    {
      marketplace: 'LAZADA',
      storeId: '300749392344',
      brandName: 'OBERMAIN',
    },
    {
      marketplace: 'LAZADA',
      storeId: '300763632066',
      brandName: 'Hush Puppies',
    },
    {
      marketplace: 'LAZADA',
      storeId: '300934544102',
      brandName: 'Beverly Hills Polo Club',
    },
  ];

  for (const mapping of mappings) {
    await prisma.marketplaceBrandMapping.upsert({
      where: {
        marketplace_storeId: {
          marketplace: mapping.marketplace,
          storeId: mapping.storeId,
        },
      },

      update: {
        brandName: mapping.brandName,
      },

      create: mapping,
    });

    console.log(
      `Mapped [${mapping.marketplace}] ${mapping.storeId} -> ${mapping.brandName}`
    );
  }

  console.log('Brand mapping seeding complete!');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });