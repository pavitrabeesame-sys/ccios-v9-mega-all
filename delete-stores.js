import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log('Cleaning up unused Store_ brands...');

  // Delete brands where the name starts with "Store_"
  const result = await prisma.brand.deleteMany({
    where: {
      name: {
        startsWith: 'Store_'
      }
    }
  });

  console.log(`Successfully deleted ${result.count} redundant Store_ brand records!`);
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());