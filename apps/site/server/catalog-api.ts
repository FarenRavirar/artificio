import { Router, type RequestHandler } from "express";
import type { AuthenticatedRequest } from "@artificio/auth";
import * as Catalog from "../db/repo/catalog.js";

const jsonEtag = (value: string) => `"${value}"`;

export function catalogApi(): Router {
  const r = Router();

  r.get("/systems", async (req, res) => {
    try {
      const snapshot = await Catalog.getSnapshot();
      const etag = jsonEtag(snapshot.checksum);
      if (req.header("if-none-match") === etag) {
        res.status(304).end();
        return;
      }
      res.setHeader("ETag", etag);
      res.json(snapshot);
    } catch (error) {
      console.error("[catalog] snapshot failed", error);
      res.status(500).json({ error: "catalog_unavailable" });
    }
  });

  r.get("/nodes/:idOrSlug", async (req, res) => {
    await resolveCatalogNode(String(req.params.idOrSlug || ""), res);
  });

  r.get("/resolve", async (req, res) => {
    await resolveCatalogNode(String(req.query.q || ""), res);
  });

  return r;
}

async function resolveCatalogNode(idOrPath: string, res: { status: (code: number) => { json: (body: unknown) => void }; json: (body: unknown) => void }): Promise<void> {
  try {
    const clean = idOrPath.trim();
    if (!clean) {
      res.status(400).json({ error: "bad_id" });
      return;
    }
    const node = await Catalog.resolveNode(clean);
    if (!node) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    res.json(node);
  } catch (error) {
    console.error("[catalog] resolve failed", error);
    res.status(500).json({ error: "catalog_unavailable" });
  }
}

export function catalogAdminApi(requireAuth: RequestHandler, requireAdmin: RequestHandler): Router {
  const r = Router();
  r.use(requireAuth, requireAdmin);

  r.get("/snapshot", async (_req, res) => {
    res.json(await Catalog.getSnapshot());
  });

  r.post("/nodes", async (req, res) => {
    try {
      const row = await Catalog.createNode(parseNodeWrite(req.body), actorOf(req));
      res.status(201).json(row);
    } catch (error) {
      handleCatalogWriteError(error, res);
    }
  });

  r.put("/nodes/:id", async (req, res) => {
    try {
      const row = await Catalog.updateNode(String(req.params.id), parseNodePatch(req.body), actorOf(req));
      if (!row) {
        res.status(404).json({ error: "not_found" });
        return;
      }
      res.json(row);
    } catch (error) {
      handleCatalogWriteError(error, res);
    }
  });

  return r;
}

function parseNodeWrite(body: unknown): Catalog.CatalogNodeWrite {
  const value = asRecord(body);
  return {
    parent_id: stringOrNull(value.parent_id),
    // Achado Sonar (PR #144): `String(value || "")` sobre payload unknown
    // vira "[object Object]" quando o campo chega como objeto malformado;
    // optionalString já faz o guard `typeof === "string"` correto.
    node_type: (optionalString(value.node_type) ?? "") as Catalog.CatalogNodeType,
    canonical_slug: optionalString(value.canonical_slug),
    name: optionalString(value.name) ?? "",
    name_pt: stringOrNull(value.name_pt),
    description: stringOrNull(value.description),
    official_website_url: stringOrNull(value.official_website_url),
    logo_media_id: stringOrNull(value.logo_media_id),
    status: optionalString(value.status) as Catalog.CatalogNodeStatus | undefined,
    aliases: stringArray(value.aliases),
  };
}

function parseNodePatch(body: unknown): Partial<Catalog.CatalogNodeWrite> {
  const value = asRecord(body);
  const patch: Partial<Catalog.CatalogNodeWrite> = {};
  if ("parent_id" in value) patch.parent_id = stringOrNull(value.parent_id);
  if ("node_type" in value) patch.node_type = (optionalString(value.node_type) ?? "") as Catalog.CatalogNodeType;
  if ("canonical_slug" in value) patch.canonical_slug = optionalString(value.canonical_slug);
  if ("name" in value) patch.name = optionalString(value.name) ?? "";
  if ("name_pt" in value) patch.name_pt = stringOrNull(value.name_pt);
  if ("description" in value) patch.description = stringOrNull(value.description);
  if ("official_website_url" in value) patch.official_website_url = stringOrNull(value.official_website_url);
  if ("logo_media_id" in value) patch.logo_media_id = stringOrNull(value.logo_media_id);
  if ("status" in value) patch.status = optionalString(value.status) as Catalog.CatalogNodeStatus | undefined;
  if ("aliases" in value) patch.aliases = stringArray(value.aliases);
  return patch;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("bad_payload");
  return value as Record<string, unknown>;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" ? value.trim() : undefined;
}

function stringOrNull(value: unknown): string | null {
  const clean = typeof value === "string" ? value.trim() : "";
  return clean.length > 0 ? clean : null;
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function actorOf(req: unknown): string | null {
  return (req as AuthenticatedRequest).session?.user?.id ?? null;
}

function handleCatalogWriteError(error: unknown, res: { status: (code: number) => { json: (body: unknown) => void } }): void {
  const message = error instanceof Error ? error.message : "catalog_write_failed";
  if (["bad_payload", "name_required", "slug_required", "bad_node_type", "bad_status", "parent_not_found"].includes(message)) {
    res.status(400).json({ error: message });
    return;
  }
  if (message.includes("duplicate key")) {
    res.status(409).json({ error: "duplicate_catalog_node" });
    return;
  }
  console.error("[catalog] write failed", error);
  res.status(500).json({ error: "catalog_write_failed" });
}
