const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  console.log("Local Database Review Count:", await prisma.review.count());
  const first = await prisma.review.findFirst();
  console.log("First Review Object:", first);
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
