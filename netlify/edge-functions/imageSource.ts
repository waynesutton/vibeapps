// Guards /_src/{uuid}, which public/_redirects proxies to prod Convex storage.
// User uploads are served from this origin here, so only raster images pass,
// with nosniff and a sandbox CSP. Anything else returns 404.
const STORAGE_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const RASTER_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/avif",
]);

const notFound = () =>
  new Response("Not found", {
    status: 404,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });

export default async (request: Request, context: any) => {
  const id = new URL(request.url).pathname.replace(/^\/_src\//, "");
  if (!STORAGE_ID.test(id)) return notFound();

  try {
    const upstream = await context.next();
    const type = (upstream.headers.get("content-type") || "")
      .split(";")[0]
      .trim()
      .toLowerCase();
    if (!upstream.ok || !RASTER_TYPES.has(type)) return notFound();

    const headers = new Headers({
      "content-type": type,
      "cache-control": "public, max-age=86400, stale-while-revalidate=604800",
      "x-content-type-options": "nosniff",
      "content-security-policy": "default-src 'none'; sandbox",
    });
    const length = upstream.headers.get("content-length");
    if (length) headers.set("content-length", length);

    return new Response(upstream.body, { status: 200, headers });
  } catch {
    return notFound();
  }
};
