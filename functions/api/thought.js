// Cloudflare Pages Function — POST /api/thought
// Sends a Thought Wall submission as an email via Resend, with abuse protection.
//
// Environment variables (Cloudflare Pages → Settings → Environment variables):
//   RESEND_API_KEY     Resend API key (secret) — required
//   MAIL_TO            delivery address        — default hello@absolutedevs.in
//   MAIL_FROM          verified Resend sender  — default onboarding@resend.dev
//   TURNSTILE_SECRET   Cloudflare Turnstile secret key — enables bot verification
//
// KV binding (Cloudflare Pages → Settings → Functions → KV namespace bindings):
//   RATE_LIMIT         a KV namespace — enables per-IP + global rate limiting
//
// Turnstile and rate limiting each activate only when their config is present,
// so nothing breaks before you've set them up — but turn BOTH on before going
// public. The email itself is injection-safe: from/to are server-side, the
// subject only uses a whitelisted emoji, and the body is HTML-escaped.

const MAX_LEN = 280;
const MOODS = ["💭", "💡", "🐛", "🚀", "🤔", "🔥"];

// Per-IP limit and global daily cap (protects your Resend quota).
const IP_LIMIT = 5;              // submissions per IP...
const IP_WINDOW_SECONDS = 600;   // ...per 10 minutes
const GLOBAL_DAILY_LIMIT = 300;  // total submissions per day across everyone

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function esc(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function verifyTurnstile(secret, token, ip) {
  if (!token) return false;
  const form = new FormData();
  form.append("secret", secret);
  form.append("response", token);
  if (ip) form.append("remoteip", ip);
  try {
    const res = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      { method: "POST", body: form }
    );
    const data = await res.json();
    return data.success === true;
  } catch {
    return false;
  }
}

// Best-effort KV rate limiting. KV isn't strongly atomic, but at this scale a
// rare race just lets one extra request through — acceptable for a contact form.
async function checkRateLimit(kv, ip) {
  const ipKey = `rl:ip:${ip}`;
  const ipCount = parseInt((await kv.get(ipKey)) || "0", 10);
  if (ipCount >= IP_LIMIT) {
    return { ok: false, reason: "Too many notes from your connection. Try again in a bit ⏳" };
  }

  const day = new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
  const globalKey = `rl:global:${day}`;
  const globalCount = parseInt((await kv.get(globalKey)) || "0", 10);
  if (globalCount >= GLOBAL_DAILY_LIMIT) {
    return { ok: false, reason: "The wall is taking a breather — please try again tomorrow." };
  }

  await kv.put(ipKey, String(ipCount + 1), { expirationTtl: IP_WINDOW_SECONDS });
  await kv.put(globalKey, String(globalCount + 1), { expirationTtl: 86400 });
  return { ok: true };
}

export async function onRequestPost({ request, env }) {
  if (!env.RESEND_API_KEY) {
    return json({ ok: false, error: "Email is not configured yet." }, 503);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "Invalid request." }, 400);
  }

  // 1) Honeypot — bots fill hidden fields; humans leave them empty.
  //    Return a fake success so bots don't learn they were caught.
  if (body.website) return json({ ok: true });

  const ip = request.headers.get("CF-Connecting-IP") || "unknown";

  // 2) Turnstile bot check (active when TURNSTILE_SECRET is set).
  if (env.TURNSTILE_SECRET) {
    const passed = await verifyTurnstile(env.TURNSTILE_SECRET, body.turnstile, ip);
    if (!passed) {
      return json({ ok: false, error: "Bot check failed — please retry." }, 403);
    }
  }

  // 3) Rate limiting (active when the RATE_LIMIT KV namespace is bound).
  if (env.RATE_LIMIT) {
    const rl = await checkRateLimit(env.RATE_LIMIT, ip);
    if (!rl.ok) return json({ ok: false, error: rl.reason }, 429);
  }

  // 4) Validation.
  const text = (body.text || "").toString().trim();
  const mood = MOODS.includes(body.mood) ? body.mood : "💭";
  if (!text) return json({ ok: false, error: "Say something first 🙂" }, 400);
  if (text.length > MAX_LEN) {
    return json({ ok: false, error: `Keep it under ${MAX_LEN} characters.` }, 400);
  }

  const to = env.MAIL_TO || "hello@absolutedevs.in";
  const from = env.MAIL_FROM || "Thought Wall <onboarding@resend.dev>";

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from,
      to,
      subject: `Thought Wall ${mood} — new note`,
      html:
        `<div style="font-family:system-ui,sans-serif;line-height:1.6">` +
        `<p style="font-size:1.5rem;margin:0 0 .5rem">${mood}</p>` +
        `<p style="white-space:pre-wrap;margin:0">${esc(text)}</p>` +
        `<hr style="border:none;border-top:1px solid #e5e7eb;margin:1.25rem 0">` +
        `<p style="color:#6b7280;font-size:.85rem;margin:0">Sent from the Absolute Devs Thought Wall · ${esc(ip)}</p>` +
        `</div>`,
      text: `${mood}\n\n${text}\n\n— Absolute Devs Thought Wall (${ip})`,
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    return json({ ok: false, error: "Could not send right now.", detail }, 502);
  }

  return json({ ok: true });
}
// Other HTTP methods get an automatic 405 from Pages since only POST is handled.
