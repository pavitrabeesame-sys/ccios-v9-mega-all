import { prisma } from "../../lib/prisma";
import { refreshAccessToken } from "./AuthService";

export async function getShopByStore(storeId) {

  return prisma.shopeeShop.findUnique({

    where: {
      storeId,
    },

    include: {
      store: true,
    },

  });

}

export async function getShopByShopId(shopId) {

  return prisma.shopeeShop.findUnique({

    where: {
      shopId: shopId.toString(),
    },

    include: {
      store: true,
    },

  });

}

export async function saveAuthorization({

  shopId,

  accessToken,

  refreshToken,

  expireIn,

}) {

  const expireAt = new Date(
    Date.now() + expireIn * 1000
  );

  return prisma.shopeeShop.update({

    where: {
      shopId: shopId.toString(),
    },

    data: {

      accessToken,

      refreshToken,

      tokenExpireAt: expireAt,

      isAuthorized: true,

    },

  });

}

export async function getValidAccessToken(shopId) {

  const shop =
    await getShopByShopId(shopId);

  if (!shop) {

    throw new Error(
      `Shopee Shop ${shopId} not found`
    );

  }

  if (
    shop.tokenExpireAt >
    new Date(Date.now() + 300000)
  ) {

    return shop.accessToken;

  }

  console.log(
    `Refreshing Token ${shopId}`
  );

  const refreshed =
    await refreshAccessToken(
      shop.refreshToken,
      shop.shopId
    );

  if (refreshed.error) {

    throw new Error(
      refreshed.message
    );

  }

  const expireAt = new Date(
    Date.now() +
      refreshed.expire_in * 1000
  );

  await prisma.shopeeShop.update({

    where: {
      shopId: shop.shopId,
    },

    data: {

      accessToken:
        refreshed.access_token,

      refreshToken:
        refreshed.refresh_token,

      tokenExpireAt:
        expireAt,

    },

  });

  return refreshed.access_token;

}