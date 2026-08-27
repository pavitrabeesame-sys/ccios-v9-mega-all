import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  /*
  ============================================================
  MULTI-MARKETPLACE BRAND MAPPINGS
  ============================================================

  SHOPEE SHOP IDs:
    RAV Design                 115383763
    Obermain                   469553987
    Hush Puppies               282544493
    John Langford              170808053
    Beverly Hills Polo Club    170811257
    Nicole                     66854646

  LAZADA SELLER IDs:
    RAV                        1000055891
    Nicole                     100164017
    Obermain                   300749392344
    Hush Puppies               300763632066
    Beverly Hills Polo Club    300934544102
  ============================================================
  */

  const mappings = [
    // ========================================================
    // SHOPEE
    // ========================================================

    {
      marketplace: 'SHOPEE',
      storeId: '115383763',
      brandName: 'RAV',
    },

    {
      marketplace: 'SHOPEE',
      storeId: '469553987',
      brandName: 'OBERMAIN',
    },

    {
      marketplace: 'SHOPEE',
      storeId: '282544493',
      brandName: 'Hush Puppies',
    },

    {
      marketplace: 'SHOPEE',
      storeId: '170808053',
      brandName: 'John Langford',
    },

    {
      marketplace: 'SHOPEE',
      storeId: '170811257',
      brandName: 'Beverly Hills Polo Club',
    },

    {
      marketplace: 'SHOPEE',
      storeId: '66854646',
      brandName: 'Nicole',
    },

    // ========================================================
    // LAZADA
    // ========================================================

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

  /*
  ============================================================
  REMOVE OLD INCORRECT SHOPEE MAPPINGS
  ============================================================

  These were previously incorrectly stored as SHOPEE IDs,
  but they are actually LAZADA seller IDs.
  ============================================================
  */

  const incorrectShopeeIds = [
    '1000055891',
    '100164017',
    '300749392344',
    '300763632066',
    '300934544102',
  ];

  const deleted = await prisma.marketplaceBrandMapping.deleteMany({
    where: {
      marketplace: 'SHOPEE',
      storeId: {
        in: incorrectShopeeIds,
      },
    },
  });

  console.log(
    `Removed ${deleted.count} incorrect SHOPEE mappings.`
  );

  /*
  ============================================================
  UPSERT CORRECT MAPPINGS
  ============================================================
  */

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

      create: {
        marketplace: mapping.marketplace,
        storeId: mapping.storeId,
        brandName: mapping.brandName,
      },
    });

    console.log(
      `Mapped [${mapping.marketplace}] ${mapping.storeId} -> ${mapping.brandName}`
    );
  }

  /*
  ============================================================
  FINAL VERIFICATION
  ============================================================
  */

  const finalMappings =
    await prisma.marketplaceBrandMapping.findMany({
      orderBy: [
        {
          marketplace: 'asc',
        },
        {
          storeId: 'asc',
        },
      ],
    });

  console.log('\n========================================');
  console.log('FINAL MARKETPLACE BRAND MAPPINGS');
  console.log('========================================');

  for (const mapping of finalMappings) {
    console.log(
      `[${mapping.marketplace}] ${mapping.storeId} -> ${mapping.brandName}`
    );
  }

  console.log('\nBrand mapping seeding complete!');
}

main()
  .catch((error) => {
    console.error('SEED ERROR:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });