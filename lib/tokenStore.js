let memoryStore = {};

function isValidUrl(url) {
  return url && url.startsWith("https://") &&!url.includes("...");
}

let redis = null;
try {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (isValidUrl(url) && token &&!token.includes("...")) {
    const { Redis } = require('@upstash/redis');
    redis = new Redis({ url, token });
    console.log("[TokenStore] Using Upstash Redis");
  } else {
    console.log("[TokenStore] No valid Upstash config, using memory + env vars");
  }
} catch (e) {
  console.log("[TokenStore] Redis init failed, using memory:", e.message);
}

export async function getToken(key) {
  try {
    if (redis) {
      const data = await redis.get(key);
      if (!data) return null;
      return typeof data === 'string'? JSON.parse(data) : data;
    }
    // Fallback to memory
    return memoryStore[key] || null;
  } catch (e) {
    console.error(`[TokenStore] get ${key} error:`, e.message);
    return memoryStore[key] || null;
  }
}

export async function setToken(key, value) {
  try {
    const payload = {...value, updated_at: Date.now() };
    if (redis) {
      await redis.set(key, JSON.stringify(payload));
    } else {
      memoryStore[key] = payload;
    }
    return true;
  } catch (e) {
    memoryStore[key] = {...value, updated_at: Date.now() };
    return true;
  }
}

export async function hasToken(key) {
  if (redis) {
    try { return (await redis.exists(key)) === 1; } catch { }
  }
  return!!memoryStore[key];
}

export async function delToken(key) {
  if (redis) try { await redis.del(key); } catch {}
  delete memoryStore[key];
  return true;
}

export const tokenStore = {
  get: getToken,
  set: setToken,
  has: hasToken,
  del: delToken,
};

export default tokenStore;