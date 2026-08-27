import crypto from 'crypto';
import { prisma as db } from '@/lib/prisma';

const HOST =
  process.env.SHOPEE_HOST ||
  'https://partner.shopeemobile.com';

const PARTNER_ID =
  String(
    process.env.SHOPEE_PARTNER_ID || ''
  ).trim();

const PARTNER_KEY =
  String(
    process.env.SHOPEE_PARTNER_KEY || ''
  ).trim();

/*
============================================================
AUTHORITATIVE SHOP ID → BRAND
============================================================
*/

export const SHOPEE_SHOP_BRANDS = {
  '115383763': {
    name: 'RAV Design',
    code: 'RAV',
  },

  '469553987': {
    name: 'Obermain',
    code: 'OBERMAIN',
  },

  '282544493': {
    name: 'Hush Puppies',
    code: 'HUSH_PUPPIES',
  },

  '170808053': {
    name: 'John Langford',
    code: 'JOHN_LANGFORD',
  },

  '170811257': {
    name: 'Beverly Hills Polo Club',
    code: 'BHPC',
  },

  '66854646': {
    name: 'Nicole Collection',
    code: 'NICOLE',
  },
};

/*
============================================================
SIGNATURE
============================================================
*/

function sign(
  baseString
) {
  if (!PARTNER_KEY) {
    throw new Error(
      'SHOPEE_PARTNER_KEY is missing.'
    );
  }

  return crypto
    .createHmac(
      'sha256',
      PARTNER_KEY
    )
    .update(baseString)
    .digest('hex');
}

/*
============================================================
TIMESTAMP
============================================================
*/

function getTimestamp() {
  return Math.floor(
    Date.now() / 1000
  );
}

/*
============================================================
VALIDATE SHOP
============================================================
*/

function validateShopId(
  shopId
) {
  const normalized =
    String(
      shopId || ''
    ).trim();

  if (
    !/^\d+$/.test(
      normalized
    )
  ) {
    throw new Error(
      `Invalid Shopee shop ID: ${normalized}`
    );
  }

  if (
    !SHOPEE_SHOP_BRANDS[
      normalized
    ]
  ) {
    throw new Error(
      `Shopee shop ${normalized} is not configured in the authoritative shop mapping.`
    );
  }

  return normalized;
}

/*
============================================================
REFRESH ACCESS TOKEN
============================================================
*/

export async function refreshShopeeAccessToken(
  shop
) {
  const shopId =
    validateShopId(
      shop.shopId
    );

  if (
    !shop.refreshToken
  ) {
    throw new Error(
      `Refresh token missing for Shopee shop ${shopId}.`
    );
  }

  const path =
    '/api/v2/auth/access_token/get';

  const timestamp =
    getTimestamp();

  const baseString =
    `${PARTNER_ID}${path}${timestamp}`;

  const signature =
    sign(
      baseString
    );

  const url =
    new URL(
      HOST + path
    );

  url.searchParams.set(
    'partner_id',
    PARTNER_ID
  );

  url.searchParams.set(
    'timestamp',
    String(timestamp)
  );

  url.searchParams.set(
    'sign',
    signature
  );

  const response =
    await fetch(
      url.toString(),
      {
        method: 'POST',

        headers: {
          'Content-Type':
            'application/json',
        },

        body: JSON.stringify({
          refresh_token:
            shop.refreshToken,

          shop_id:
            Number(shopId),

          partner_id:
            Number(
              PARTNER_ID
            ),
        }),

        cache: 'no-store',
      }
    );

  const data =
    await response.json();

  if (
    !response.ok
  ) {
    throw new Error(
      `Shopee token refresh HTTP ${response.status}: ${JSON.stringify(data)}`
    );
  }

  if (
    !data.access_token
  ) {
    throw new Error(
      data.message ||
        data.error ||
        'Shopee token refresh failed.'
    );
  }

  /*
  Update database if accountId
  was supplied.
  */

  if (
    shop.accountId
  ) {
    await db.shopeeAccount.update({
      where: {
        id:
          shop.accountId,
      },

      data: {
        accessToken:
          data.access_token,

        refreshToken:
          data.refresh_token ??
          shop.refreshToken,

        updatedAt:
          new Date(),
      },
    });
  }

  return data.access_token;
}

/*
============================================================
GET ITEM REVIEWS
============================================================
Shopee API:
GET /api/v2/product/get_comment
============================================================
*/

export async function getItemReviews({
  shopId,
  accessToken,
  itemId,
  cursor = '',
  pageSize = 50,
}) {
  if (
    !shopId ||
    !accessToken ||
    !itemId
  ) {
    throw new Error(
      'shopId, accessToken, itemId are required'
    );
  }

  const normalizedShopId =
    validateShopId(
      shopId
    );

  const path =
    '/api/v2/product/get_comment';

  const timestamp =
    getTimestamp();

  const base =
    `${PARTNER_ID}${path}${timestamp}${accessToken}${normalizedShopId}`;

  const signature =
    sign(base);

  const url =
    new URL(
      HOST + path
    );

  url.searchParams.set(
    'partner_id',
    PARTNER_ID
  );

  url.searchParams.set(
    'timestamp',
    String(timestamp)
  );

  url.searchParams.set(
    'access_token',
    accessToken
  );

  url.searchParams.set(
    'shop_id',
    normalizedShopId
  );

  url.searchParams.set(
    'item_id',
    String(itemId)
  );

  url.searchParams.set(
    'cursor',
    cursor || ''
  );

  url.searchParams.set(
    'page_size',
    String(pageSize)
  );

  url.searchParams.set(
    'sign',
    signature
  );

  console.log(
    '[Shopee] Fetching reviews:',
    {
      shopId:
        normalizedShopId,

      brand:
        SHOPEE_SHOP_BRANDS[
          normalizedShopId
        ]?.name,

      itemId,
    }
  );

  const response =
    await fetch(
      url.toString(),
      {
        method: 'GET',
        cache: 'no-store',
      }
    );

  const data =
    await response.json();

  if (
    !response.ok
  ) {
    throw new Error(
      `Shopee get_comment HTTP ${response.status}: ${JSON.stringify(data)}`
    );
  }

  if (
    data.error
  ) {
    console.error(
      '[Shopee] get_comment Error:',
      data
    );

    throw new Error(
      `Shopee API Error: ${
        data.message ||
        data.error
      }`
    );
  }

  /*
  IMPORTANT:
  Your live sync route receives:

  response.item_comment_list

  not:

  data.data.comments

  Support both shapes for safety.
  */

  const responseData =
    data?.response ||
    data?.data ||
    {};

  const reviews =
    Array.isArray(
      responseData.item_comment_list
    )
      ? responseData.item_comment_list
      : Array.isArray(
          responseData.comments
        )
      ? responseData.comments
      : [];

  const hasMore =
    responseData.more === true ||
    responseData.has_next_page === true;

  const nextCursor =
    responseData.next_cursor ||
    responseData.nextCursor ||
    '';

  return {
    reviews,

    hasMore,

    nextCursor,
  };
}

/*
============================================================
REPLY TO SHOPEE REVIEW
============================================================
Shopee API:
POST /api/v2/product/reply_comment
============================================================
*/

export async function replyShopeeReview(
  shop,
  reviewId,
  reply
) {
  if (
    !shop?.shopId ||
    !shop?.accessToken
  ) {
    return {
      success: false,

      status:
        'FAILED',

      error:
        'Shopee shopId and accessToken are required.',
    };
  }

  if (
    !reviewId
  ) {
    return {
      success: false,

      status:
        'FAILED',

      error:
        'Shopee review/comment ID is required.',
    };
  }

  if (
    !reply ||
    !String(reply).trim()
  ) {
    return {
      success: false,

      status:
        'FAILED',

      error:
        'Reply content is empty.',
    };
  }

  const normalizedShopId =
    validateShopId(
      shop.shopId
    );

  let accessToken =
    shop.accessToken;

  const path =
    '/api/v2/product/reply_comment';

  /*
  ==========================================================
  FIRST ATTEMPT + TOKEN RETRY
  ==========================================================
  */

  for (
    let attempt = 0;
    attempt < 2;
    attempt++
  ) {
    const timestamp =
      getTimestamp();

    const base =
      `${PARTNER_ID}${path}${timestamp}${accessToken}${normalizedShopId}`;

    const signature =
      sign(base);

    const url =
      new URL(
        HOST + path
      );

    url.searchParams.set(
      'partner_id',
      PARTNER_ID
    );

    url.searchParams.set(
      'timestamp',
      String(timestamp)
    );

    url.searchParams.set(
      'access_token',
      accessToken
    );

    url.searchParams.set(
      'shop_id',
      normalizedShopId
    );

    url.searchParams.set(
      'sign',
      signature
    );

    const body = {
      comment_id:
        String(reviewId),

      reply_content:
        String(reply).trim(),
    };

    console.log(
      '[Shopee] Replying to review:',
      {
        shopId:
          normalizedShopId,

        brand:
          SHOPEE_SHOP_BRANDS[
            normalizedShopId
          ]?.name,

        reviewId:
          String(reviewId),

        attempt:
          attempt + 1,
      }
    );

    const response =
      await fetch(
        url.toString(),
        {
          method: 'POST',

          headers: {
            'Content-Type':
              'application/json',
          },

          body:
            JSON.stringify(
              body
            ),

          cache: 'no-store',
        }
      );

    const data =
      await response.json();

    /*
    --------------------------------------------------------
    TOKEN ERROR
    --------------------------------------------------------
    */

    const errorText =
      String(
        data?.error ||
          data?.message ||
          ''
      ).toLowerCase();

    const tokenError =
      errorText.includes(
        'access_token'
      ) ||
      errorText.includes(
        'access token'
      ) ||
      errorText.includes(
        'token'
      );

    if (
      tokenError &&
      attempt === 0 &&
      shop.refreshToken
    ) {
      try {
        accessToken =
          await refreshShopeeAccessToken({
            ...shop,

            shopId:
              normalizedShopId,
          });

        continue;
      } catch (refreshError) {
        return {
          success: false,

          status:
            'FAILED',

          error:
            `Shopee token refresh failed: ${refreshError.message}`,
        };
      }
    }

    /*
    --------------------------------------------------------
    API FAILURE
    --------------------------------------------------------
    */

    if (
      !response.ok ||
      data.error
    ) {
      console.error(
        '[Shopee] reply_comment Error:',
        data
      );

      return {
        success: false,

        status:
          'FAILED',

        error:
          data.message ||
          data.error ||
          `Shopee reply failed with HTTP ${response.status}.`,

        response:
          data,
      };
    }

    /*
    --------------------------------------------------------
    SUCCESS
    --------------------------------------------------------
    */

    return {
      success: true,

      status:
        'APPROVED',

      response:
        data,

      shopId:
        normalizedShopId,

      reviewId:
        String(reviewId),
    };
  }

  return {
    success: false,

    status:
      'FAILED',

    error:
      'Shopee reply failed after token retry.',
  };
}

/*
============================================================
SYNC ALL SHOP REVIEWS
============================================================
*/

export async function syncAllShopReviews(
  shop
) {
  const shopId =
    validateShopId(
      shop.shopId
    );

  console.log(
    '[Shopee Sync] Starting:',
    {
      shopId,

      brand:
        SHOPEE_SHOP_BRANDS[
          shopId
        ]?.name,
    }
  );

  /*
  This helper intentionally remains
  item-based because get_comment
  requires item_id in this service.

  Your main /api/shopee/reviews/sync
  route is the preferred shop-wide
  synchronization endpoint.
  */

  return {
    total: 0,

    shopId,

    brand:
      SHOPEE_SHOP_BRANDS[
        shopId
      ],
  };
}