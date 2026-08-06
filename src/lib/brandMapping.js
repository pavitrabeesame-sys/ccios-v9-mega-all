import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Fallback safety map in case table isn't seeded yet
const FALLBACK_MAP = {
  "1000055891": "RAV",
  "100164017": "Nicole",
  "300749392344": "OBERMAIN",
  "300763632066": "HUSH PUPPIES",
  "300934544102": "BHPC",
};

export async function resolveBrandName(marketplace, storeId) {
  const cleanStoreId = String(storeId || "").trim();
  const cleanMarketplace = String(marketplace || "").toUpperCase();

  try {
    const mapping = await prisma.marketplaceBrandMapping.findUnique({
      where: {
        marketplace_storeId: {
          marketplace: cleanMarketplace,
          storeId: cleanStoreId,
        }
      }
    });

    if (mapping && mapping.brandName) {
      return mapping.brandName;
    }
  } catch (err) {
    console.error(`[BrandMapping Error] Failed to query mapping for ${cleanMarketplace}:${cleanStoreId}`, err.message);
  }

  // Fallback to dictionary or structured string
  return FALLBACK_MAP[cleanStoreId] || `Store_${cleanStoreId}`;
}