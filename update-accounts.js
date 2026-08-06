const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Map your Shop IDs to their respective Brand names
const STORE_BRAND_MAP = {
  "1000055891": "RAV",
  "100164017": "Nicole",
  "300749392344": "OBERMAIN",
  "300763632066": "HUSH PUPPIES",
  "300934544102": "BHPC",
};

async function main() {
  console.log("🔗 Linking Shopee accounts to brands...");
  
  const brands = await prisma.brand.findMany();
  const accounts = await prisma.shopeeAccount.findMany();

  for (const account of accounts) {
    const shopIdStr = account.shopId.toString();
    const brandName = STORE_BRAND_MAP[shopIdStr];
    
    if (brandName) {
      const brand = brands.find(b => 
        b.name.toLowerCase() === brandName.toLowerCase() || 
        b.code.toLowerCase() === brandName.toLowerCase()
      );
      
      if (brand) {
        await prisma.shopeeAccount.update({
          where: { id: account.id },
          data: { brandId: brand.id }
        });
        console.log(`✅ Successfully linked Shop ID ${shopIdStr} to Brand: ${brand.name}`);
      } else {
        console.log(`⚠️ Brand "${brandName}" not found in database for Shop ID ${shopIdStr}`);
      }
    } else {
      console.log(`ℹ️ No mapping found for Shop ID ${shopIdStr}`);
    }
  }
  console.log("✨ All account mappings completed!");
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });