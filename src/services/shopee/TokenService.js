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

  if (!token.refreshToken) {
    throw new Error(
      `Shopee refresh token not found for shop ${shopId}`
    );
  }

  const expireIn = Number(token.expireIn || 0);

  const age =
    (Date.now() - token.updatedAt.getTime()) / 1000;

  // Keep a 5-minute safety buffer.
  if (expireIn > 300 && age < expireIn - 300) {
    return token;
  }

  console.log(
    `[Shopee Token] Refreshing token for shop ${shopId}...`
  );

  const refreshed = await refreshAccessToken(
    token.refreshToken,
    shopId
  );

  if (!refreshed || refreshed.error) {
    throw new Error(
      refreshed?.message ||
      refreshed?.error ||
      `Failed to refresh Shopee token for shop ${shopId}`
    );
  }

  if (!refreshed.access_token) {
    throw new Error(
      `Shopee refresh returned no access_token for shop ${shopId}`
    );
  }

  await saveToken({
    shopId,
    accessToken: refreshed.access_token,
    refreshToken:
      refreshed.refresh_token || token.refreshToken,
    expireIn:
      Number(refreshed.expire_in || expireIn),
  });

  const updated = await getToken(shopId);

  if (!updated?.accessToken) {
    throw new Error(
      `Shopee token was refreshed but could not be saved for shop ${shopId}`
    );
  }

  return updated;
}