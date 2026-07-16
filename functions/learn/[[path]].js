// Cloudflare Pages Function — SPA fallback for the explainers under /learn/.
//
// The explainers are a client-routed single-page app: paths like
// /learn/kubernetes exist only in the browser router, not as files on disk.
// This catch-all serves real assets (JS/CSS/index.html) as-is, and returns
// the app shell (/learn/) for anything that would otherwise 404 — so a deep
// link or refresh on /learn/<slug> loads the app and lets it route client-side.
//
// (A _redirects "200 rewrite" would normally do this, but Pages auto-redirects
// /learn/index.html -> /learn/, which collides with rewriting to it. Serving
// the asset directly from a Function sidesteps that entirely.)
export async function onRequest(context) {
  const { request, env } = context;

  // Serve the real static asset when one exists at this path.
  const asset = await env.ASSETS.fetch(request);
  if (asset.status !== 404) return asset;

  // Unknown path under /learn/ -> hand back the app shell (200) to route.
  return env.ASSETS.fetch(new URL("/learn/", request.url));
}
