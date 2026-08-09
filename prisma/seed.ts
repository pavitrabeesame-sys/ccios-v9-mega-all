// prisma/seed.ts
import { PrismaClient, Marketplace, Role } from "@prisma/client";
import { randomUUID } from "crypto";

const prisma = new PrismaClient();

async function main() {
  // Create Company
  const company = await prisma.company.create({
    data: {
      id: randomUUID(),
      name: "CCIOS Demo",
      code: "CCIOS",
      description: "Demo Company",
      updatedAt: new Date(),
    },
  });

  // Create Brand
  await prisma.brand.create({
    data: {
      id: randomUUID(),
      name: "Demo Brand",
      code: "DEMO",
      updatedAt: new Date(),
      Company: {
        connect: {
          id: company.id,
        },
      },
    },
  });

  // Create Store
  await prisma.store.create({
    data: {
      id: randomUUID(),
      name: "Shopee Main",
      companyId: company.id,
      marketplace: Marketplace.SHOPEE,
      updatedAt: new Date(),
    },
  });

  // Create Admin User
  await prisma.user.create({
    data: {
      id: randomUUID(),
      email: "admin@ccios.com",
      name: "Admin",
      password: "123456",
      role: Role.SUPER_ADMIN,
      updatedAt: new Date(),
      Company: {
        connect: {
          id: company.id,
        },
      },
    },
  });

  console.log("✅ Seed completed successfully.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });