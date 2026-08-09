import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const result = await prisma.$queryRaw`
    SELECT column_name, data_type, udt_name
    FROM information_schema.columns
    WHERE table_name = 'MarketplaceBrandMapping'
    AND column_name = 'marketplace';
  `;
  console.log(result);
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
