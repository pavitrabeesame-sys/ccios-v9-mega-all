let memoryStore = {};

function isValidUrl(url) {
  return url && url.startsWith("https://") && !url.includes("...");
}

let redis = null;

try {
  const url =
    process.env.KV_REST_API_URL ||
    process.env.UPSTASH_REDIS_REST_URL;

  const token =
    process.env.KV_REST_API_TOKEN ||
    process.env.UPSTASH_REDIS_REST_TOKEN;

  if (isValidUrl(url) && token && !token.includes("...")) {
    const { Redis } = require("@upstash/redis");

    redis = new Redis({
      url,
      token,
    });

    console.log("[TokenStore] Using Upstash Redis");
  } else {
    console.log("[TokenStore] Using Memory Store");
  }
} catch (e) {
  console.log("[TokenStore] Redis disabled:", e.message);
}

export async function getToken(key) {
  if (redis) {
    const data = await redis.get(key);
    return data;
  }

  return memoryStore[key] || null;
}

export async function setToken(key, value) {
  if (redis) {
    await redis.set(key, value);
  }

  memoryStore[key] = value;
}

export async function hasToken(key) {
  if (redis) {
    return (await redis.exists(key)) === 1;
  }

  return !!memoryStore[key];
}

export async function delToken(key) {
  if (redis) {
    await redis.del(key);
  }

  delete memoryStore[key];
}

const tokenStore = {
  get: getToken,
  set: setToken,
  has: hasToken,
  del: delToken,
};

export default tokenStore;