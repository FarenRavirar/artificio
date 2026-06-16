#!/usr/bin/env node
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(process.argv[2] ?? "dist");
const port = Number(process.argv[3] ?? 4175);

const types = new Map([
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".svg", "image/svg+xml"],
  [".ico", "image/x-icon"],
]);

function safePath(urlPath) {
  const decoded = decodeURIComponent(urlPath.split("?")[0] ?? "/");
  const candidate = path.resolve(root, `.${decoded}`);
  if (!candidate.startsWith(root)) return null;
  return candidate;
}

async function resolveFile(urlPath) {
  const candidate = safePath(urlPath);
  if (!candidate) return null;
  try {
    const info = await stat(candidate);
    if (info.isFile()) return candidate;
  } catch {
    // SPA fallback below.
  }
  return path.join(root, "index.html");
}

createServer(async (request, response) => {
  try {
    const file = await resolveFile(request.url ?? "/");
    if (!file) {
      response.writeHead(403);
      response.end("Forbidden");
      return;
    }
    const body = await readFile(file);
    response.writeHead(200, {
      "content-type": types.get(path.extname(file)) ?? "application/octet-stream",
      "cache-control": "no-store",
    });
    response.end(body);
  } catch {
    response.writeHead(404);
    response.end("Not found");
  }
}).listen(port, "127.0.0.1", () => {
  console.log(`Serving ${root} at http://127.0.0.1:${port}/`);
});
