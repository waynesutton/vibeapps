export default async (request: Request) => {
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
    if (!isBot) return fetch(request);

    // Extract slug from /s/{slug}
    const match = url.pathname.match(/^\/s\/(.+)$/);
    if (!match) return fetch(request);
    const slug = match[1];

    const metaUrl = `https://acoustic-goldfinch-461.convex.site/meta/s?slug=${encodeURIComponent(
      slug,
    )}`;

    const res = await fetch(metaUrl, {
      headers: {
        "cache-control":
          "public, max-age=60, s-maxage=300, stale-while-revalidate=600",
      },
    });
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
    return fetch(request);
  }
};

export const config = { path: "/s/*" };
