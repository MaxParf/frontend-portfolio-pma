import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const cmsRoot = resolve(fileURLToPath(new URL(".", import.meta.url)));
const repositoryRoot = resolve(cmsRoot, "..");
const contentTypes = { ".css": "text/css; charset=utf-8", ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".ico": "image/x-icon" };

function contained(root, relativePath) {
  const target = resolve(root, relativePath);
  return target.startsWith(`${root}${sep}`) ? target : null;
}

function safePathname(requestUrl) {
  let pathname = new URL(requestUrl, "http://127.0.0.1").pathname;
  for (let pass = 0; pass < 3; pass += 1) {
    let decoded; try { decoded = decodeURIComponent(pathname); } catch { return null; }
    if (decoded === pathname) break;
    pathname = decoded;
  }
  if (!pathname.startsWith("/") || pathname.includes("\0") || pathname.includes("\\") || pathname.split("/").some((part) => part === ".." || part === ".")) return null;
  return pathname;
}

export function resolveCmsLiteRoute(requestUrl) {
  const pathname = safePathname(requestUrl); if (!pathname) return null;
  if (pathname === "/" || pathname === "/index.html") return contained(cmsRoot, "index.html");
  if (pathname === "/login" || pathname === "/login/") return contained(cmsRoot, "login/index.html");
  const cmsFiles = new Set(["/cms.css", "/cms.js", "/login.js", "/session.js", "/password-change.js", "/api.js"]);
  if (cmsFiles.has(pathname)) return contained(cmsRoot, pathname.slice(1));
  const roots = [
    ["/editor/", cmsRoot], ["/storage/", cmsRoot], ["/project-core/", repositoryRoot], ["/components/", repositoryRoot], ["/services/", repositoryRoot], ["/images/", repositoryRoot],
  ];
  for (const [prefix, root] of roots) if (pathname.startsWith(prefix)) return contained(root, pathname.slice(1));
  const publicFiles = new Set(["/script.js", "/style.css", "/i18n.js", "/analytics.js", "/data/projects.lite.json"]);
  return publicFiles.has(pathname) ? contained(repositoryRoot, pathname.slice(1)) : null;
}

export function createCmsLiteServer() {
  return createServer(async (request, response) => {
    const filename = resolveCmsLiteRoute(request.url ?? "/");
    if (!filename) return response.writeHead(404, { "content-type": "text/plain; charset=utf-8" }).end("Not found");
    try { const body = await readFile(filename); response.writeHead(200, { "content-type": contentTypes[extname(filename)] ?? "application/octet-stream", "cache-control": "no-store", "x-content-type-options": "nosniff" }); response.end(body); }
    catch { response.writeHead(404, { "content-type": "text/plain; charset=utf-8" }).end("Not found"); }
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.CMS_LITE_PORT ?? 5511);
  createCmsLiteServer().listen(port, "127.0.0.1", () => console.log(`Portfolio CMS Lite: http://127.0.0.1:${port}/`));
}
