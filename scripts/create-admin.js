const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  const password = await bcrypt.hash("admin123", 12);

  const user = await prisma.user.create({
    data: {
      name: "Administrator",
      email: "admin@ccios.com",
      password,
      role: "SUPER_ADMIN",
    },
  });

  console.log("Admin created:");
  console.log(user);
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });