export default async (request: Request, context: any) => {
  try {
    const url = new URL(request.url);
    const ua = (request.headers.get("user-agent") || "").toLowerCase();

    // Known social crawlers
    const bots = [
      "facebookexternalhit",
      "twitterbot",
      "linkedinbot",
      "discordbot",
      "slackbot",
      "telegrambot",
      "whatsapp",
      "pinterest",
      "opengraph",
      "opengraphbot",
      "bot ",
      "crawler",
      "embedly",
      "vkshare",
      "quora link preview",
    ];

    const isBot = bots.some((b) => ua.includes(b));

    // Only intercept bot traffic; let browsers hit SPA normally
    if (!isBot) return context.next();

    // Extract slug from /judging/{slug}/submit
    const match = url.pathname.match(/^\/judging\/([^\/]+)\/submit$/);
    if (!match) return fetch(request);
    const slug = match[1];

    // Use PRODUCTION Convex deployment for crawler-visible metadata
    const metaUrl = `https://whimsical-dalmatian-205.convex.site/meta/submit?slug=${encodeURIComponent(
      slug,
    )}`;

    let res = await fetch(metaUrl, {
      headers: {
        "cache-control":
          "public, max-age=60, s-maxage=300, stale-while-revalidate=600",
      },
    });
    if (res.status === 404) {
      const devUrl = `https://acoustic-goldfinch-461.convex.site/meta/submit?slug=${encodeURIComponent(slug)}`;
      res = await fetch(devUrl, {
        headers: {
          "cache-control":
            "public, max-age=60, s-maxage=300, stale-while-revalidate=600",
        },
      });
    }
    return new Response(await res.text(), {
      status: res.status,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control":
          "public, max-age=60, s-maxage=300, stale-while-revalidate=600",
      },
    });
  } catch (e) {
    // On failure, fall back to SPA
    return context.next();
  }
};

export const config = { path: "/submit/*" };

