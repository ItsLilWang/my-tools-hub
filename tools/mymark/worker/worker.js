// =====================================================
// MyMark Sync Worker
// Giữ vault (đã mã hoá sẵn ở client) trong Cloudflare KV.
// Chỉ ai gửi đúng "vé vào cửa" mới đọc / ghi được.
// =====================================================

// ---- [1] CẤU HÌNH ----
// Những trang được phép gọi Worker này (CORS).
// 127.0.0.1:5500 / localhost:5500 = Live Server khi bro test trên máy.
const ALLOWED_ORIGINS = [
  "https://itslilwang.github.io",
  "http://127.0.0.1:5500",
  "http://localhost:5500",
];
const MAX_BODY_CHARS = 2 * 1024 * 1024; // ~2 MB, dư sức cho bookmark
const FUTURE_TOLERANCE_MS = 60 * 60 * 1000; // chặn savedAt "từ tương lai" quá 1 giờ

// ---- [2] CỬA CHÍNH: mọi request đi qua đây ----
export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const cors = corsHeaders(origin);

    // Trình duyệt hỏi thăm trước khi gửi PUT (preflight)
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }

    const url = new URL(request.url);
    if (url.pathname !== "/vault" && url.pathname !== "/meta") {
      return json({ error: "not_found" }, 404, cors);
    }

    // Soát vé (cả /vault lẫn /meta đều phải có vé)
    if (!(await isAuthorized(request, env))) {
      return json({ error: "unauthorized" }, 401, cors);
    }

    if (url.pathname === "/meta") {
      if (request.method !== "GET") return json({ error: "method_not_allowed" }, 405, cors);
      return handleMeta(url, cors);
    }
    if (request.method === "GET") return handleGet(env, cors);
    if (request.method === "PUT") return handlePut(request, env, cors);
    return json({ error: "method_not_allowed" }, 405, cors);
  },
};

// ---- [3] SOÁT VÉ ----
// Client gửi: Authorization: Bearer <token>
// Worker băm token bằng SHA-256 rồi so với AUTH_HASH (secret trên Cloudflare).
async function isAuthorized(request, env) {
  if (!env.AUTH_HASH) return false;
  const header = request.headers.get("Authorization") || "";
  if (!header.startsWith("Bearer ")) return false;
  const token = header.slice(7).trim();
  if (token.length < 32) return false;
  const hash = await sha256Hex(token);
  return safeEqual(hash, env.AUTH_HASH.trim().toLowerCase());
}

// ---- [4] ĐỌC VAULT ----
async function handleGet(env, cors) {
  const data = await env.VAULT_KV.get("vault");
  if (!data) return json({ empty: true }, 200, cors);
  return new Response(data, {
    status: 200,
    headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

// ---- [5] GHI VAULT ----
// Body client gửi lên: { "savedAt": <số ms>, "vault": "<nội dung vault đã mã hoá>" }
async function handlePut(request, env, cors) {
  const text = await request.text();
  if (text.length > MAX_BODY_CHARS) return json({ error: "too_large" }, 413, cors);

  let body;
  try {
    body = JSON.parse(text);
  } catch {
    return json({ error: "bad_json" }, 400, cors);
  }
  if (typeof body.savedAt !== "number" || typeof body.vault !== "string" || !body.vault) {
    return json({ error: "bad_format" }, 400, cors);
  }
  if (body.savedAt > Date.now() + FUTURE_TOLERANCE_MS) {
    return json({ error: "clock_in_future" }, 400, cors);
  }

  // Chỉ nhận bản MỚI HƠN bản đang có -> chống máy cũ đè máy mới
  const current = await env.VAULT_KV.get("vault");
  let currentSavedAt = 0;
  if (current) {
    try {
      currentSavedAt = JSON.parse(current).savedAt || 0;
    } catch {
      currentSavedAt = 0;
    }
    if (body.savedAt <= currentSavedAt) {
      return json({ error: "stale", serverSavedAt: currentSavedAt }, 409, cors);
    }
  }

  try {
    // Cất bản cũ làm backup trước khi ghi đè
    if (current) await env.VAULT_KV.put("vault_prev", current);
    await env.VAULT_KV.put("vault", JSON.stringify({ savedAt: body.savedAt, vault: body.vault }));
  } catch {
    // KV chỉ cho ghi cùng 1 key tối đa 1 lần/giây, hoặc hết quota ngày
    return json({ error: "write_failed" }, 503, cors);
  }
  return json({ ok: true, savedAt: body.savedAt }, 200, cors);
}

// ---- [5b] LẤY TIÊU ĐỀ + THUMBNAIL CỦA 1 LINK ----
// Các "kiểu trình duyệt" để gửi kèm khi tải trang (nhiều trang chặn request trông giống bot)
const BROWSER_PROFILES = [
  { name: "chrome_desktop", headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      "Accept-Language": "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7",
      "Upgrade-Insecure-Requests": "1",
      "Sec-Fetch-Dest": "document",
      "Sec-Fetch-Mode": "navigate",
      "Sec-Fetch-Site": "none",
      "Sec-Fetch-User": "?1",
  } },
  { name: "chrome_mobile", headers: {
      "User-Agent": "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "vi-VN,vi;q=0.9,en;q=0.8",
  } },
];

// GET /meta?url=https://...  →  { title, image, siteName }
// Worker tải trang giùm (server không bị luật CORS chặn) rồi đọc thẻ og:... trong HTML.
// Lấy không được thì trả rỗng chứ không báo lỗi → form vẫn cho tự điền.
const META_MAX_BYTES = 1536 * 1024; // đọc tới hết <head> thì dừng, tối đa 1.5 MB
const META_KEYS = ["og:title", "twitter:title", "og:image", "og:image:url", "og:image:secure_url",
                   "twitter:image", "twitter:image:src", "og:site_name"];

async function handleMeta(reqUrl, cors) {
  let target;
  try {
    target = new URL(reqUrl.searchParams.get("url") || "");
  } catch {
    return json({ error: "bad_url" }, 400, cors);
  }
  if (target.protocol !== "http:" && target.protocol !== "https:") {
    return json({ error: "bad_url" }, 400, cors);
  }

  const yt = youtubeId(target);
  const out = { title: "", image: yt ? `https://i.ytimg.com/vi/${yt}/hqdefault.jpg` : "", siteName: "" };
  // Nhật ký từng bước → tool in ra Console để biết vì sao lấy hụt
  const debug = { reason: "", steps: [] };
  out.debug = debug;
  const done = (reason) => { debug.reason = reason; return json(out, 200, cors); };

  // YouTube / TikTok / Vimeo: hỏi thẳng "cổng chính thức" oEmbed của họ → chắc ăn hơn đọc HTML
  const oe = await tryOembed(target, debug);
  if (oe && oe.title) {
    out.title = oe.title.slice(0, 300);
    out.siteName = oe.siteName;
    if (!out.image) out.image = absUrl(oe.image, target.toString());
    return done("ok_oembed");
  }

  // Tải trang: thử lần lượt từng "kiểu trình duyệt", bị chặn (403/429/503) thì đổi kiểu
  let res = null;
  let lastErr = null;
  for (const profile of BROWSER_PROFILES) {
    try {
      res = await fetch(target.toString(), {
        redirect: "follow",
        signal: AbortSignal.timeout(8000), // chờ tối đa 8 giây
        headers: profile.headers,
      });
    } catch (e) {
      lastErr = e;
      res = null;
      debug.steps.push({ step: "fetch_page", as: profile.name, error: `${e.name}: ${e.message}` });
      continue;
    }
    debug.steps.push({ step: "fetch_page", as: profile.name, status: res.status, finalUrl: res.url,
                       contentType: res.headers.get("content-type") || "",
                       server: res.headers.get("server") || "",
                       cfMitigated: res.headers.get("cf-mitigated") || undefined });
    if (![403, 429, 503].includes(res.status)) break;
    res.body?.cancel().catch(() => {});
  }
  if (!res) return done(lastErr?.name === "TimeoutError" ? "timeout_8s" : "fetch_error");
  const type = res.headers.get("content-type") || "";
  if (!res.ok) return done(`http_${res.status}`);
  if (!type.includes("html")) return done("not_html");

  // Chỉ đọc phần <head> (thẻ og nằm ở đó), tối đa META_MAX_BYTES
  const html = await readHead(res, META_MAX_BYTES);
  debug.steps.push({ step: "read_head", chars: html.length });

  // HTMLRewriter = "máy soi HTML" có sẵn của Cloudflare, nhẹ và nhanh
  const found = {};
  let titleText = "";
  await new HTMLRewriter()
    .on("meta", {
      element(el) {
        const key = (el.getAttribute("property") || el.getAttribute("name") || "").toLowerCase();
        const content = el.getAttribute("content");
        if (content && META_KEYS.includes(key) && !found[key]) found[key] = content.trim();
      },
    })
    .on("head title", {
      text(t) {
        if (titleText.length < 500) titleText += t.text;
      },
    })
    .transform(new Response(html))
    .arrayBuffer();

  const base = res.url || target.toString();
  out.title = decodeEntities(found["og:title"] || found["twitter:title"] || titleText).replace(/\s+/g, " ").trim().slice(0, 300);
  out.siteName = decodeEntities(found["og:site_name"] || "").trim();
  if (!out.image) {
    const img = found["og:image"] || found["og:image:secure_url"] || found["og:image:url"] ||
                found["twitter:image"] || found["twitter:image:src"] || "";
    out.image = absUrl(decodeEntities(img), base);
  }
  debug.steps.push({ step: "parse", foundMeta: Object.keys(found), titleTag: titleText.trim().slice(0, 120),
                     preview: html.length < 3000 ? html.slice(0, 500) : undefined });
  if (out.title && out.image) return done("ok");
  if (!out.title && !out.image) return done(html.length < 3000 ? "empty_page_maybe_js_or_blocked" : "no_meta");
  return done(out.title ? "no_image" : "no_title");
}

// Đọc HTML tới khi gặp </head> thì dừng (hoặc đủ maxBytes)
async function readHead(res, maxBytes) {
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let html = "";
  let total = 0;
  while (total < maxBytes) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    const from = Math.max(0, html.length - 10); // chỉ dò đoạn mới tải về
    html += dec.decode(value, { stream: true });
    const end = html.slice(from).search(/<\/head\s*>/i);
    if (end !== -1) {
      html = html.slice(0, from + end);
      break;
    }
  }
  reader.cancel().catch(() => {});
  return html;
}

// oEmbed = API chính thức trả về { title, thumbnail_url } của 1 video
const OEMBED = [
  { test: (u) => !!youtubeId(u),
    api: (u) => "https://www.youtube.com/oembed?format=json&url=" +
                encodeURIComponent("https://www.youtube.com/watch?v=" + youtubeId(u)) },
  { test: (u) => /(^|\.)tiktok\.com$/i.test(u.hostname),
    api: (u) => "https://www.tiktok.com/oembed?url=" + encodeURIComponent(u.toString()) },
  { test: (u) => /(^|\.)vimeo\.com$/i.test(u.hostname),
    api: (u) => "https://vimeo.com/api/oembed.json?url=" + encodeURIComponent(u.toString()) },
];
async function tryOembed(u, debug) {
  const provider = OEMBED.find((p) => p.test(u));
  if (!provider) return null;
  try {
    const r = await fetch(provider.api(u), { signal: AbortSignal.timeout(6000), headers: { Accept: "application/json" } });
    debug.steps.push({ step: "oembed", status: r.status });
    if (!r.ok) return null;
    const d = await r.json();
    return { title: String(d.title || "").trim(), image: d.thumbnail_url || "", siteName: d.provider_name || "" };
  } catch (e) {
    debug.steps.push({ step: "oembed", error: `${e.name}: ${e.message}` });
    return null;
  }
}

// Lấy mã video YouTube (watch?v=, youtu.be/, shorts/, embed/, live/)
function youtubeId(u) {
  const host = u.hostname.replace(/^(www|m|music)\./, "");
  let id = null;
  if (host === "youtu.be") id = u.pathname.slice(1).split("/")[0];
  else if (host === "youtube.com") {
    id = u.searchParams.get("v") || (u.pathname.match(/^\/(shorts|embed|live)\/([^/?#]+)/) || [])[2];
  }
  return id && /^[\w-]{6,20}$/.test(id) ? id : null;
}

// "/img/a.jpg" → "https://trang.com/img/a.jpg"; chỉ nhận http/https
function absUrl(u, base) {
  if (!u) return "";
  try {
    const full = new URL(u, base);
    return full.protocol === "http:" || full.protocol === "https:" ? full.toString() : "";
  } catch {
    return "";
  }
}

// "&amp;" → "&", "&#39;" → "'" ...
function decodeEntities(s) {
  const named = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
  return String(s).replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === "#") {
      const n = e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return n > 0 && n < 0x110000 ? String.fromCodePoint(n) : m;
    }
    return named[e.toLowerCase()] ?? m;
  });
}

// ---- [6] HÀM PHỤ ----
function corsHeaders(origin) {
  if (!ALLOWED_ORIGINS.includes(origin)) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, PUT, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function json(obj, status, cors) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

async function sha256Hex(str) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// So sánh 2 chuỗi mà không "lộ" qua thời gian chạy
function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
