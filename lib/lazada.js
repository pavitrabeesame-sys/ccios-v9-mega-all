import crypto from "crypto";

const APP_KEY = process.env.LAZADA_APP_KEY;
const APP_SECRET = process.env.LAZADA_APP_SECRET;
const API_HOST = "https://api.lazada.com.my/rest";
const AUTH_HOST = "https://auth.lazada.com/rest";

export const LAZADA_BRANDS = [
  "RAV",
  "OBERMAIN",
  "CHAMPION",
  "JOHN_LANGFORD",
  "BEVERLY_HILLS_POLO_CLUB",
  "HUSH_PUPPIES",
  "NICOLE_COLLECTION"
];

export function isConfigured() {
  return !!(APP_KEY && APP_SECRET);
}

export function configuredBrands() {
  return LAZADA_BRANDS.filter(
    (brand) =>
      process.env[`LAZADA_${brand}_REFRESH_TOKEN`] ||
      process.env[`LAZADA_REFRESH_TOKEN_${brand}`]
  );
}

function signRequest(path, params) {
  const sorted = Object.keys(params)
    .sort()
    .map((k) => `${k}${params[k]}`)
    .join("");

  return crypto
    .createHmac("sha256", APP_SECRET)
    .update(path + sorted)
    .digest("hex")
    .toUpperCase();
}

async function getLazadaToken(brand) {
  const refreshToken =
    process.env[`LAZADA_${brand}_REFRESH_TOKEN`] ||
    process.env[`LAZADA_REFRESH_TOKEN_${brand}`];

  if (!refreshToken)
    throw new Error(`${brand}: No refresh token in environment`);

  const apiPath = "/auth/token/refresh";

  const params = {
    app_key: APP_KEY,
    timestamp: Date.now().toString(),
    sign_method: "sha256",
    refresh_token: refreshToken,
  };

  params.sign = signRequest(apiPath, params);

  const url =
    AUTH_HOST +
    apiPath +
    "?" +
    new URLSearchParams(params).toString();

  console.log("[Lazada Refresh]", url);

  const res = await fetch(url, {
    method: "POST",
  });

  const json = await res.json();

  console.log("[Lazada Refresh Response]", json);

  const data = json.data || json;

  if (!data.access_token) {
    throw new Error(
      json.message ||
        json.code ||
        "Unable to obtain access token"
    );
  }

  return data.access_token;
}

export async function lazadaGet(
  brand,
  apiPath,
  extraParams = {}
) {
  const accessToken = await getLazadaToken(brand);

  const params = {
    app_key: APP_KEY,
    timestamp: Date.now().toString(),
    sign_method: "sha256",
    access_token: accessToken,
    ...extraParams,
  };

  params.sign = signRequest(apiPath, params);

  const url =
    API_HOST +
    apiPath +
    "?" +
    new URLSearchParams(params).toString();

  console.log("[Lazada Request]", url);

  const res = await fetch(url);

  const json = await res.json();

  console.log("[Lazada Response]", json);

  return json;
}

// Optional compatibility
export async function lazadaRequest(
  brand,
  apiPath,
  extraParams = {}
) {
  return lazadaGet(brand, apiPath, extraParams);
}