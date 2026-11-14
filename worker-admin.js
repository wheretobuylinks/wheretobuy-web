const OWNER = "wheretobuylinks";
const REPO = "wheretobuy-web";
const BRANCH = "main";
const FILE = "posts.json";
const ALLOWED_ORIGIN = "https://wheretobuy-web.pages.dev";

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const cors = {
      "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Vary": "Origin"
    };
    if (request.method === "OPTIONS") return new Response(null, { headers: cors });
    if (origin !== ALLOWED_ORIGIN) return new Response("Origin not allowed", { status: 403, headers: cors });
    if (request.method !== "POST") return new Response("Use POST", { status: 405, headers: cors });

    try {
      const body = await request.json();
      if (!env.ADMIN_PASSWORD || body.password !== env.ADMIN_PASSWORD) {
        return new Response(JSON.stringify({ error: "Clave incorrecta" }), { status: 401, headers: { ...cors, "Content-Type": "application/json" } });
      }
      const title = String(body.title || "").trim().slice(0, 180);
      const socialUrl = String(body.socialUrl || "").trim();
      const buyUrl = String(body.buyUrl || "").trim();
      const imageUrl = String(body.imageUrl || "").trim();
      const description = String(body.description || "").trim().slice(0, 500);
      if (!title || !validUrl(socialUrl) || !validUrl(buyUrl) || (imageUrl && !validUrl(imageUrl))) {
        return new Response(JSON.stringify({ error: "Completá título y enlaces válidos (https://)." }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
      }
      const api = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${FILE}`;
      const headers = { Authorization: `Bearer ${env.GITHUB_TOKEN}`, "X-GitHub-Api-Version": "2022-11-28", Accept: "application/vnd.github+json", "Content-Type": "application/json", "User-Agent": "WhereToBuyAdmin" };
      const get = await fetch(api + `?ref=${BRANCH}`, { headers });
      let posts = [], sha;
      if (get.ok) {
        const current = await get.json();
        sha = current.sha;
        try { posts = JSON.parse(atob(current.content.replace(/\\n/g, ""))); } catch { posts = []; }
      } else if (get.status !== 404) {
        return new Response(JSON.stringify({ error: "No se pudo leer el archivo de posts en GitHub." }), { status: 502, headers: { ...cors, "Content-Type": "application/json" } });
      }
      posts.unshift({ id: crypto.randomUUID(), title, socialUrl, buyUrl, imageUrl, description, createdAt: new Date().toISOString() });
      const content = btoa(unescape(encodeURIComponent(JSON.stringify(posts, null, 2))));
      const put = await fetch(api, { method: "PUT", headers, body: JSON.stringify({ message: "Publicar post desde panel Where to Buy", content, branch: BRANCH, ...(sha ? { sha } : {}) }) });
      if (!put.ok) return new Response(JSON.stringify({ error: "GitHub no pudo guardar el post. Revisá permisos del token." }), { status: 502, headers: { ...cors, "Content-Type": "application/json" } });
      return new Response(JSON.stringify({ ok: true, message: "Post guardado. Cloudflare Pages lo publicará cuando termine el deploy." }), { headers: { ...cors, "Content-Type": "application/json" } });
    } catch {
      return new Response(JSON.stringify({ error: "Error inesperado al guardar." }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
    }
  }
};
function validUrl(value) { try { const u = new URL(value); return u.protocol === "https:"; } catch { return false; } }
