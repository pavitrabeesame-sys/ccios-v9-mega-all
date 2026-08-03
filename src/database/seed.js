import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const hashedPassword = await bcrypt.hash("Admin@123", 12);

  await prisma.user.upsert({
    where: {
      email: "admin@ccios.com",
    },
    update: {},
    create: {
      name: "Super Admin",
      email: "admin@ccios.com",
      password: hashedPassword,
      role: Role.SUPER_ADMIN,
    },
  });

  console.log("✅ SUPER_ADMIN created");
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });