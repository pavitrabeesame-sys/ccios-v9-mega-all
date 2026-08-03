import { prisma } from "../../lib/prisma";
import { refreshAccessToken } from "./AuthService";

export async function saveToken(token) {

  return prisma.shopeeAccount.upsert({

    where: {
      shopId: BigInt(token.shopId),
    },

    update: {

      accessToken: token.accessToken,

      refreshToken: token.refreshToken,

      expireIn: token.expireIn,

    },

    create: {

      shopId: BigInt(token.shopId),

      accessToken: token.accessToken,

      refreshToken: token.refreshToken,

      expireIn: token.expireIn,

    },

  });

}

export async function getToken(shopId) {

  return prisma.shopeeAccount.findUnique({

    where: {
      shopId: BigInt(shopId),
    },

  });

}

export async function getValidToken(shopId) {

  const token = await getToken(shopId);

  if (!token) {

    throw new Error(
      `Shopee token not found for shop ${shopId}`
    );

  }

  const age =
    (Date.now() - token.updatedAt.getTime()) / 1000;

  if (age < token.expireIn - 300) {

    return token;

  }

  console.log(
    `Refreshing Shopee Token for ${shopId}...`
  );

  const refreshed =
    await refreshAccessToken(
      token.refreshToken,
      shopId
    );

  if (refreshed.error) {

    throw new Error(
      refreshed.message || refreshed.error
    );

  }

  await saveToken({

    shopId,

    accessToken:
      refreshed.access_token,

    refreshToken:
      refreshed.refresh_token,

    expireIn:
      refreshed.expire_in,

  });

  return await getToken(shopId);

}