// Tiny local API gateway for `npm run dev`. In production, Vercel runs
// the files in /api directly as serverless functions; this script exists
// only so the same code works against `vite` on localhost.
//
// Usage: node scripts/local-api.mjs  (run alongside `vite`)
// NOTE: This file is launched via `node --import tsx scripts/local-api.mjs`
// (or simply via the npm script that does the same). Loader registration is
// handled by the --import flag, not by code.
import { createServer } from "node:http";
import { pathToFileURL } from "node:url";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
// Load .env.local first (Vite-style), then .env as fallback.
import { config as dotenvConfig } from "dotenv";
dotenvConfig({ path: ".env.local" });
dotenvConfig({ path: ".env" });

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const ROUTES = {
  "/api/jobs": "/api/jobs.ts",
  "/api/lumina": "/api/lumina.ts",
  "/api/geocode": "/api/geocode.ts",
  "/api/gmail-search": "/api/gmail-search.ts",
  "/api/drive-list": "/api/drive-list.ts",
};

async function loadHandler(p) {
  const mod = await import(pathToFileURL(resolve(ROOT, "." + p)).href);
  return mod.default;
}

async function readJson(req) {
  return new Promise((res, rej) => {
    let data = "";
    req.on("data", (c) => (data += c));
    req.on("end", () => {
      try {
        res(data ? JSON.parse(data) : {});
      } catch (e) {
        rej(e);
      }
    });
    req.on("error", rej);
  });
}

const server = createServer(async (req, res) => {
  const u = new URL(req.url, "http://localhost");
  const handlerPath = ROUTES[u.pathname];
  if (!handlerPath) {
    res.statusCode = 404;
    res.end("Not found");
    return;
  }
  try {
    const body = req.method === "POST" ? await readJson(req) : undefined;
    const handler = await loadHandler(handlerPath);
    const fakeReq = {
      method: req.method,
      query: Object.fromEntries(u.searchParams),
      body,
      headers: req.headers,
    };
    const fakeRes = {
      _status: 200,
      _headers: {},
      status(s) {
        this._status = s;
        return this;
      },
      setHeader(k, v) {
        this._headers[k] = v;
        return this;
      },
      json(obj) {
        res.writeHead(this._status, { "Content-Type": "application/json", ...this._headers });
        res.end(JSON.stringify(obj));
      },
    };
    await handler(fakeReq, fakeRes);
  } catch (err) {
    console.error("[local-api] error", err);
    res.statusCode = 500;
    res.end(JSON.stringify({ error: String(err?.message || err) }));
  }
});

const PORT = 3001;
server.listen(PORT, () => {
  console.log(`[local-api] listening on http://localhost:${PORT}`);
});
