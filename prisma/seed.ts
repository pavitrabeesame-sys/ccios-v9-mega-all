import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const company = await prisma.company.create({
    data: {
      name: "CCIOS Demo",
      code: "CCIOS",
      description: "Demo Company"
    }
  })

  await prisma.brand.create({
    data: { name: "Demo Brand", code: "DEMO", companyId: company.id }
  })

  await prisma.store.create({
    data: { name: "Shopee Main", companyId: company.id, marketplace: "SHOPEE" }
  })

  await prisma.user.create({
    data: { email: "admin@ccios.com", name: "Admin", password: "123456", role: "SUPER_ADMIN", companyId: company.id }
  })
}

main()