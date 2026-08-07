const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const SHOPEE_BRAND_MAPPING = {
  "66854646": "Nicole",
  "190669704": "Nicole",
  "170808053": "John Langford",
  "170811257": "Beverly Hills Polo Club",
  "1770621264": "RAV",
  "1770621271": "RAV",
  "115383763": "RAV",
  "74401016": "RAV",
  "1637647671": "Obermain",
  "1747523033": "Obermain",
  "1747523036": "Obermain",
  "469553987": "Obermain",
  "282544493": "Hush Puppies",
};

async function fixNames() {
  console.log("Updating review store and brand names...");
  
  for (const [shopId, brandName] of Object.entries(SHOPEE_BRAND_MAPPING)) {
    const result = await prisma.review.updateMany({
      where: { storeName: shopId },
      data: { storeName: brandName, brand: brandName }
    });
    console.log(`Updated ${result.count} reviews for store ID ${shopId} -> ${brandName}`);
  }

  console.log("Store name fix completed!");
}

fixNames()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
