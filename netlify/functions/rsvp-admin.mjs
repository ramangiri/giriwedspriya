import { pbkdf2Sync, timingSafeEqual } from "node:crypto";

const SALT = "891465cd4239629c94c2ab939658e199";
const HASH = "30ed37c5a5a6683f368ef8890d0fb5e8ecd53e6bc20dd17fc717a8398dd37dae";
const FORM_ID = "6af13b60bcc7393e2a739b9e";
const ITERATIONS = 210000;

// Only a salted password hash lives in source; the random admin password
// itself is never placed in the repository or sent to the guest-facing site.
function authorized(request) {
  const header = request.headers.get("authorization") || "";
  if (!header.startsWith("Basic ") || header.length > 350) return false;
  let credentials = "";
  try { credentials = Buffer.from(header.slice(6), "base64").toString("utf8"); }
  catch { return false; }
  const colon = credentials.indexOf(":");
  if (colon === -1 || credentials.slice(0, colon) !== "admin") return false;
  const password = credentials.slice(colon + 1);
  if (!password || password.length > 128) return false;
  const derived = pbkdf2Sync(password, Buffer.from(SALT, "hex"), ITERATIONS, 32, "sha256");
  return timingSafeEqual(derived, Buffer.from(HASH, "hex"));
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store, private, max-age=0",
      "pragma": "no-cache",
      "x-content-type-options": "nosniff",
      "x-frame-options": "DENY",
      "referrer-policy": "no-referrer",
      "content-security-policy": "default-src 'none'; frame-ancestors 'none'"
    }
  });
}

function clean(value, maxLen = 500) {
  return String(value ?? "").slice(0, maxLen);
}
function normalize(submission) {
  const d = submission.data && typeof submission.data === "object" ? submission.data : {};
  const response = clean(d.attendance, 20).trim().toLowerCase();
  const attending = response === "yes" ? "yes" : response === "no" ? "no" : "unknown";
  const parsedGuests = Number.parseInt(d.guests, 10);
  const guests = attending === "yes"
    ? Number.isFinite(parsedGuests) ? Math.max(1, Math.min(parsedGuests, 15)) : 1
    : 0;
  return {
    id: clean(submission.id, 80),
    name: clean(d.guest_name || submission.name, 100),
    attendance: attending,
    guests,
    contact: clean(d.contact, 140),
    message: clean(d.message, 500),
    submitted: clean(submission.created_at, 50)
  };
}

export default async function handler(request) {
  if (request.method !== "GET") return json({ error: "METHOD_NOT_ALLOWED" }, 405);
  if (!authorized(request)) return json({ error: "UNAUTHORIZED" }, 401);

  // Guest data stays on Netlify and reaches only a password-authenticated
  // admin browser. A token must be supplied in Netlify Functions environment.
  const token = process.env.NETLIFY_RSVP_API_TOKEN || "";
  if (!token) return json({
    connected: false,
    entries: [],
    message: "Automatic sync needs NETLIFY_RSVP_API_TOKEN set in Netlify Functions environment variables."
  });

  try {
    const entries = [];
    let truncated = false;
    for (let page = 1; page <= 51; page++) {
      const url = "https://api.netlify.com/api/v1/forms/" + FORM_ID
        + "/submissions?page=" + page + "&per_page=100";
      const response = await fetch(url, {
        method: "GET",
        headers: { authorization: "Bearer " + token, accept: "application/json" },
        signal: AbortSignal.timeout(12000),
        cache: "no-store"
      });
      if (response.status === 401 || response.status === 403)
        return json({ error: "TOKEN_NOT_AUTHORIZED" }, 502);
      if (!response.ok) return json({ error: "NETLIFY_API_UNAVAILABLE" }, 502);
      const pageRows = await response.json();
      if (!Array.isArray(pageRows)) return json({ error: "UNEXPECTED_API_FORMAT" }, 502);
      if (page === 51) { truncated = true; break; }
      for (const entry of pageRows) entries.push(normalize(entry));
      if (pageRows.length < 100) break;
    }
    return json({ connected: true, entries, truncated });
  } catch {
    return json({ error: "NETLIFY_API_UNAVAILABLE" }, 502);
  }
}
