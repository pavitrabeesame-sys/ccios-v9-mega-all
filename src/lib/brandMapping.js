import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// ============================================================
// FALLBACK MAP
// ============================================================

const FALLBACK_MAP = {
  "1000055891": "RAV",
  "100164017": "Nicole",
  "300749392344": "Obermain",
  "300763632066": "Hush Puppies",
  "300934544102": "Beverly Hills Polo Club",
};

// ============================================================
// LAZADA BRAND MAP
// ============================================================

export const LAZADA_BRAND_MAPPING = {
  "1000055891": {
    name: "RAV",
    code: "RAV",
  },

  "100164017": {
    name: "Nicole",
    code: "NICOLE",
  },

  "300749392344": {
    name: "Obermain",
    code: "OBERMAIN",
  },

  "300763632066": {
    name: "Hush Puppies",
    code: "HUSH_PUPPIES",
  },

  "300934544102": {
    name: "Beverly Hills Polo Club",
    code: "BHPC",
  },
};

// ============================================================
// SHOPEE BRAND MAP
// ============================================================

export const SHOPEE_BRAND_MAPPING = {
  "1000055891": {
    name: "RAV",
    code: "RAV",
  },

  "100164017": {
    name: "Nicole",
    code: "NICOLE",
  },

  "300749392344": {
    name: "Obermain",
    code: "OBERMAIN",
  },

  "300763632066": {
    name: "Hush Puppies",
    code: "HUSH_PUPPIES",
  },

  "300934544102": {
    name: "Beverly Hills Polo Club",
    code: "BHPC",
  },
};

// ============================================================
// MASTER BRAND RESOLVER
// ============================================================

export async function resolveBrandName(
  marketplace,
  storeId
) {
  const cleanMarketplace = String(
    marketplace || ""
  )
    .trim()
    .toUpperCase();

  const cleanStoreId = String(
    storeId || ""
  ).trim();

  if (!cleanStoreId) {
    return "Our Store";
  }

  try {
    const mapping =
      await prisma.marketplaceBrandMapping.findUnique({
        where: {
          marketplace_storeId: {
            marketplace: cleanMarketplace,
            storeId: cleanStoreId,
          },
        },
      });

    if (
      mapping &&
      mapping.brandName
    ) {
      return mapping.brandName;
    }
  } catch (error) {
    console.error(
      `[BrandMapping] Database lookup failed: ${cleanMarketplace}:${cleanStoreId}`,
      error?.message || error
    );
  }

  return (
    FALLBACK_MAP[cleanStoreId] ||
    `Store_${cleanStoreId}`
  );
}

// ============================================================
// MASTER BRAND OBJECT
// ============================================================

export async function resolveBrand(
  marketplace,
  storeId
) {
  const brandName =
    await resolveBrandName(
      marketplace,
      storeId
    );

  const normalized =
    String(brandName)
      .trim()
      .toUpperCase();

  if (
    normalized === "RAV"
  ) {
    return {
      name: "RAV",
      code: "RAV",
    };
  }

  if (
    normalized === "NICOLE"
  ) {
    return {
      name: "Nicole",
      code: "NICOLE",
    };
  }

  if (
    normalized === "OBERMAIN"
  ) {
    return {
      name: "Obermain",
      code: "OBERMAIN",
    };
  }

  if (
    normalized ===
      "HUSH PUPPIES" ||
    normalized ===
      "HUSHPUPPIES"
  ) {
    return {
      name: "Hush Puppies",
      code: "HUSH_PUPPIES",
    };
  }

  if (
    normalized === "BHPC" ||
    normalized.includes(
      "BEVERLY HILLS POLO"
    )
  ) {
    return {
      name:
        "Beverly Hills Polo Club",
      code: "BHPC",
    };
  }

  return {
    name: brandName,
    code: normalized.replace(
      /[^A-Z0-9]+/g,
      "_"
    ),
  };
}