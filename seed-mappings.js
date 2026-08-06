import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const mappings = [
    { marketplace: 'SHOPEE', storeId: '1000055891', brandName: 'RAV' },
    { marketplace: 'SHOPEE', storeId: '100164017', brandName: 'Nicole' },
    { marketplace: 'SHOPEE', storeId: '300749392344', brandName: 'OBERMAIN' },
    { marketplace: 'SHOPEE', storeId: '300763632066', brandName: 'HUSH PUPPIES' },
    { marketplace: 'SHOPEE', storeId: '300934544102', brandName: 'BHPC' },
    { marketplace: 'LAZADA', storeId: '1000055891', brandName: 'RAV' },
    { marketplace: 'LAZADA', storeId: '100164017', brandName: 'Nicole' },
    { marketplace: 'LAZADA', storeId: '300749392344', brandName: 'OBERMAIN' },
    { marketplace: 'LAZADA', storeId: '300763632066', brandName: 'HUSH PUPPIES' },
    { marketplace: 'LAZADA', storeId: '300934544102', brandName: 'BHPC' },
  ];

  for (const m of mappings) {
    await prisma.marketplaceBrandMapping.upsert({
      where: {
        marketplace_storeId: {
          marketplace: m.marketplace,
          storeId: m.storeId,
        }
      },
      update: { brandName: m.brandName },
      create: m,
    });
    console.log(`Mapped [${m.marketplace}] Store ${m.storeId} -> ${m.brandName}`);
  }
  console.log("Brand mapping seeding complete!");
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());