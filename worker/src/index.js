const SEC_ALLOWED_ORIGINS = ["https://www.sec.gov", "https://data.sec.gov"];
const CACHE_SECONDS = 60 * 60 * 6;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") return corsResponse(null);
    if (url.pathname !== "/sec") return corsResponse("Not found", { status: 404 });

    const target = url.searchParams.get("url");
    if (!target) return corsResponse("Missing url", { status: 400 });

    let secUrl;
    try {
      secUrl = new URL(target);
    } catch {
      return corsResponse("Invalid url", { status: 400 });
    }

    if (!SEC_ALLOWED_ORIGINS.includes(secUrl.origin)) {
      return corsResponse("Origin not allowed", { status: 403 });
    }

    const cache = caches.default;
    const cacheKey = new Request(secUrl.toString(), request);
    const cached = await cache.match(cacheKey);
    if (cached) return withCors(cached);

    const response = await fetch(secUrl.toString(), {
      headers: {
        Accept: "application/json",
        "User-Agent": env.SEC_USER_AGENT || "Company Analyzer contact@example.com"
      }
    });

    const proxied = new Response(response.body, response);
    proxied.headers.set("Cache-Control", `public, max-age=${CACHE_SECONDS}`);
    proxied.headers.set("Access-Control-Allow-Origin", "*");
    proxied.headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
    proxied.headers.set("Access-Control-Allow-Headers", "Content-Type, Accept");

    if (response.ok) await cache.put(cacheKey, proxied.clone());
    return proxied;
  }
};

function corsResponse(body, init = {}) {
  const response = new Response(body, init);
  response.headers.set("Access-Control-Allow-Origin", "*");
  response.headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type, Accept");
  return response;
}

function withCors(response) {
  const cors = new Response(response.body, response);
  cors.headers.set("Access-Control-Allow-Origin", "*");
  return cors;
}
