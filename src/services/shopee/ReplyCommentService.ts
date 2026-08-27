import crypto from "crypto";
import { prisma as db } from "@/lib/prisma";
import { getValidToken } from "@/services/shopee/TokenService";

const SHOPEE_HOST =
  "https://partner.shopeemobile.com";

const SHOPEE_REPLY_PATH =
  "/api/v2/product/reply_comment";

const SHOPEE_TIMEOUT_MS = 15000;

const SHOPEE_PARTNER_ID =
  String(process.env.SHOPEE_PARTNER_ID || "")
    .trim()
    .replace(/['"]/g, "");

const SHOPEE_PARTNER_KEY =
  String(process.env.SHOPEE_PARTNER_KEY || "")
    .trim()
    .replace(/['"]/g, "");

export type ShopeeReplyInput = {
  shopId: string | number | bigint;
  commentId: string | number | bigint;
  comment: string;
};

export type ShopeeReplyResult = {
  success: true;
  shopId: string;
  commentId: number;
  response: unknown;
};

function getErrorMessage(error: unknown): string {
  if (!error) {
    return "Unknown error";
  }

  if (typeof error === "string") {
    return error;
  }

  if (error instanceof Error) {
    return error.message;
  }

  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

function validateShopeeConfig(): void {
  if (!SHOPEE_PARTNER_ID) {
    throw new Error(
      "SHOPEE_PARTNER_ID is not configured."
    );
  }

  if (!SHOPEE_PARTNER_KEY) {
    throw new Error(
      "SHOPEE_PARTNER_KEY is not configured."
    );
  }
}

function createSignature({
  partnerId,
  partnerKey,
  path,
  timestamp,
  accessToken,
  shopId,
}: {
  partnerId: string;
  partnerKey: string;
  path: string;
  timestamp: number;
  accessToken: string;
  shopId: string;
}): string {
  const baseString =
    String(partnerId) +
    String(path) +
    String(timestamp) +
    String(accessToken) +
    String(shopId);

  return crypto
    .createHmac("sha256", partnerKey)
    .update(baseString)
    .digest("hex");
}

async function getShopeeAccount(
  shopId: string
) {
  let numericShopId: bigint;

  try {
    numericShopId = BigInt(shopId);
  } catch {
    throw new Error(
      `Invalid shopId "${shopId}".`
    );
  }

  const account =
    await db.shopeeAccount.findUnique({
      where: {
        shopId: numericShopId,
      },
    });

  if (!account) {
    throw new Error(
      `No ShopeeAccount found for shopId ${shopId}.`
    );
  }

  const validToken =
    await getValidToken(shopId);

  if (
    !validToken ||
    !validToken.accessToken
  ) {
    throw new Error(
      `Unable to obtain a valid Shopee access token for shopId ${shopId}.`
    );
  }

  return {
    ...account,

    accessToken:
      validToken.accessToken,

    refreshToken:
      validToken.refreshToken,

    expireIn:
      validToken.expireIn,
  };
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller =
    new AbortController();

  const timeout =
    setTimeout(
      () => controller.abort(),
      timeoutMs
    );

  try {
    return await fetch(
      url,
      {
        ...options,
        signal:
          controller.signal,
      }
    );
  } catch (error) {
    if (
      error instanceof Error &&
      error.name === "AbortError"
    ) {
      throw new Error(
        `Shopee API request timed out after ${timeoutMs}ms.`
      );
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function validateShopeeResponse(
  data: unknown
): void {
  if (
    !data ||
    typeof data !== "object"
  ) {
    return;
  }

  const responseData =
    data as Record<string, any>;

  const error =
    responseData.error;

  const message =
    responseData.message;

  const requestId =
    responseData.request_id;

  // ==========================================================
  // TOP LEVEL ERROR
  // ==========================================================

  if (
    error &&
    String(error).toLowerCase() !== "0"
  ) {
    throw new Error(
      `Shopee reply failed: ${String(error)}${
        message
          ? ` - ${String(message)}`
          : ""
      }${
        requestId
          ? ` (request_id: ${String(requestId)})`
          : ""
      }`
    );
  }

  // ==========================================================
  // RESULT LIST ERROR
  // ==========================================================

  const resultList =
    responseData?.response
      ?.result_list;

  if (
    Array.isArray(resultList)
  ) {
    const failedResult =
      resultList.find(
        (item: any) =>
          item &&
          (
            item.fail_error ||
            item.fail_message
          )
      );

    if (failedResult) {
      throw new Error(
        `Shopee reply failed: ${
          failedResult.fail_error ||
          "unknown_error"
        }${
          failedResult.fail_message
            ? ` - ${failedResult.fail_message}`
            : ""
        }${
          requestId
            ? ` (request_id: ${requestId})`
            : ""
        }`
      );
    }
  }

  // ==========================================================
  // MESSAGE ERROR
  // ==========================================================

  if (message) {
    const lowerMessage =
      String(message).toLowerCase();

    if (
      lowerMessage.includes("error") ||
      lowerMessage.includes("fail")
    ) {
      throw new Error(
        `Shopee reply failed: ${String(message)}`
      );
    }
  }
}

export async function replyToShopee(
  input: ShopeeReplyInput
): Promise<ShopeeReplyResult> {
  validateShopeeConfig();

  const shopId =
    String(input.shopId).trim();

  const commentId =
    Number(input.commentId);

  const comment =
    String(input.comment || "").trim();

  if (!shopId) {
    throw new Error(
      "shopId is required."
    );
  }

  if (
    !Number.isSafeInteger(commentId) ||
    commentId <= 0
  ) {
    throw new Error(
      `Invalid Shopee commentId: ${String(
        input.commentId
      )}`
    );
  }

  if (!comment) {
    throw new Error(
      "Shopee reply comment is empty."
    );
  }

  const account =
    await getShopeeAccount(
      shopId
    );

  const accessToken =
    String(account.accessToken || "").trim();

  if (!accessToken) {
    throw new Error(
      `Shopee account ${shopId} has no valid access token.`
    );
  }

  const timestamp =
    Math.floor(
      Date.now() / 1000
    );

  const signature =
    createSignature({
      partnerId:
        SHOPEE_PARTNER_ID,

      partnerKey:
        SHOPEE_PARTNER_KEY,

      path:
        SHOPEE_REPLY_PATH,

      timestamp,

      accessToken,

      shopId,
    });

  const url =
    `${SHOPEE_HOST}${SHOPEE_REPLY_PATH}` +
    `?partner_id=${encodeURIComponent(
      SHOPEE_PARTNER_ID
    )}` +
    `&timestamp=${encodeURIComponent(
      timestamp
    )}` +
    `&access_token=${encodeURIComponent(
      accessToken
    )}` +
    `&shop_id=${encodeURIComponent(
      shopId
    )}` +
    `&sign=${encodeURIComponent(
      signature
    )}`;

  console.log(
    "[Shopee Reply] Calling Shopee API"
  );

  console.log(
    "[Shopee Reply] Shop:",
    shopId
  );

  console.log(
    "[Shopee Reply] Comment ID:",
    commentId
  );

  const response =
    await fetchWithTimeout(
      url,
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",
        },

        body: JSON.stringify({
          comment_list: [
            {
              comment_id:
                commentId,

              comment,
            },
          ],
        }),
      },
      SHOPEE_TIMEOUT_MS
    );

  const rawText =
    await response.text();

  let data: unknown;

  try {
    data =
      JSON.parse(rawText);
  } catch {
    data = rawText;
  }

  console.log(
    "[Shopee Reply] HTTP:",
    response.status
  );

  console.log(
    "[Shopee Reply] Response:",
    JSON.stringify(data)
  );

  if (!response.ok) {
    throw new Error(
      `Shopee HTTP ${response.status}: ${
        typeof data === "string"
          ? data
          : JSON.stringify(data)
      }`
    );
  }

  validateShopeeResponse(data);

  console.log(
    "[Shopee Reply] SUCCESS:",
    commentId
  );

  return {
    success: true,
    shopId,
    commentId,
    response: data,
  };
}

export async function replyToShopeeForReview(
  reviewId: string,
  reply: string
): Promise<ShopeeReplyResult> {
  if (!reviewId) {
    throw new Error(
      "reviewId is required."
    );
  }

  if (
    !reply ||
    !reply.trim()
  ) {
    throw new Error(
      "reply is required."
    );
  }

  const review =
    await db.review.findUnique({
      where: {
        id: reviewId,
      },
    });

  if (!review) {
    throw new Error(
      `Review ${reviewId} was not found.`
    );
  }

  if (
    String(
      review.marketplace
    ).toUpperCase() !== "SHOPEE"
  ) {
    throw new Error(
      `Review ${reviewId} is not a Shopee review.`
    );
  }

  if (
    review.reviewId === null ||
    review.reviewId === undefined ||
    String(
      review.reviewId
    ).trim() === ""
  ) {
    throw new Error(
      `Review ${reviewId} does not contain a Shopee reviewId.`
    );
  }

  if (
    review.shopId === null ||
    review.shopId === undefined ||
    String(
      review.shopId
    ).trim() === ""
  ) {
    throw new Error(
      `Review ${reviewId} does not contain shopId.`
    );
  }

  return replyToShopee({
    shopId:
      String(review.shopId),

    commentId:
      Number(review.reviewId),

    comment:
      reply.trim().replace(
        /\s+/g,
        " "
      ),
  });
}

export function formatShopeeError(
  error: unknown
): string {
  return getErrorMessage(error);
}