// Repo de feedback (problema/sugestão) do widget público (Spec 021).
import { getDb } from "../connection.js";
import type { NormalizedFeedback } from "../../server/lib/feedback-validator.js";

export interface FeedbackInsert extends NormalizedFeedback {
  reporter_id: string | null;
  reporter_role: string;
  screenshot_url: string | null;
  screenshot_public_id: string | null;
}

export interface FeedbackRow {
  id: number;
  kind: string;
  title: string;
  description: string;
  reporter_id: string | null;
  reporter_role: string | null;
  contact_email: string | null;
  page_url: string | null;
  route_path: string | null;
  page_title: string | null;
  environment: string | null;
  user_agent: string | null;
  viewport: string | null;
  console_errors: unknown[];
  network_errors: unknown[];
  screenshot_url: string | null;
  screenshot_public_id: string | null;
  status: string;
  admin_notes: string | null;
  archived_at: string | null;
  created_at: string;
}

const VALID_STATUS = new Set(["new", "triaged", "in_progress", "resolved", "wont_fix", "duplicate"]);
const VALID_KIND = new Set(["bug", "suggestion"]);

export async function createFeedback(f: FeedbackInsert): Promise<{ id: number }> {
  const db = await getDb();
  const r = await db.query<{ id: number }>(
    `INSERT INTO dev_feedback
      (reporter_id, reporter_role, contact_email, kind, title, description,
       page_url, route_path, page_title, environment, user_agent, viewport,
       console_errors, network_errors, screenshot_url, screenshot_public_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb,$14::jsonb,$15,$16)
     RETURNING id`,
    [
      f.reporter_id, f.reporter_role, f.contact_email, f.kind, f.title, f.description,
      f.page_url, f.route_path, f.page_title, f.environment, f.user_agent, f.viewport,
      JSON.stringify(f.console_errors), JSON.stringify(f.network_errors),
      f.screenshot_url, f.screenshot_public_id,
    ],
  );
  return { id: r.rows[0]!.id };
}

export async function listFeedback(params: { status?: string; kind?: string; archived?: string }): Promise<FeedbackRow[]> {
  const db = await getDb();
  const where: string[] = [];
  const args: unknown[] = [];

  if (params.status && VALID_STATUS.has(params.status)) {
    args.push(params.status);
    where.push(`status = $${args.length}`);
  }
  if (params.kind && VALID_KIND.has(params.kind)) {
    args.push(params.kind);
    where.push(`kind = $${args.length}`);
  }
  const archived = params.archived ?? "false";
  if (archived === "true") where.push("archived_at IS NOT NULL");
  else if (archived !== "all") where.push("archived_at IS NULL");

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  return (await db.query<FeedbackRow>(
    `SELECT * FROM dev_feedback ${whereSql} ORDER BY created_at DESC LIMIT 500`,
    args,
  )).rows;
}

export async function updateFeedback(
  id: number,
  patch: { status?: string; admin_notes?: string | null; archived?: boolean; reviewed_by?: string | null },
): Promise<FeedbackRow | null> {
  const db = await getDb();
  const sets: string[] = ["updated_at = now()", "reviewed_at = now()"];
  const args: unknown[] = [];

  args.push(patch.reviewed_by ?? null);
  sets.push(`reviewed_by = $${args.length}`);

  if (typeof patch.status === "string" && VALID_STATUS.has(patch.status)) {
    args.push(patch.status);
    sets.push(`status = $${args.length}`);
  }
  if (patch.admin_notes !== undefined) {
    const notes = (patch.admin_notes ?? "").trim();
    args.push(notes.length > 0 ? notes.slice(0, 4000) : null);
    sets.push(`admin_notes = $${args.length}`);
  }
  if (typeof patch.archived === "boolean") {
    sets.push(`archived_at = ${patch.archived ? "now()" : "NULL"}`);
  }

  args.push(id);
  const r = await db.query<FeedbackRow>(
    `UPDATE dev_feedback SET ${sets.join(", ")} WHERE id = $${args.length} RETURNING *`,
    args,
  );
  return r.rows[0] ?? null;
}

export async function getFeedbackScreenshotId(id: number): Promise<{ found: boolean; public_id: string | null }> {
  const db = await getDb();
  const r = await db.query<{ screenshot_public_id: string | null }>(
    `SELECT screenshot_public_id FROM dev_feedback WHERE id = $1`, [id],
  );
  if (r.rows.length === 0) return { found: false, public_id: null };
  return { found: true, public_id: r.rows[0]!.screenshot_public_id };
}

export async function deleteFeedback(id: number): Promise<boolean> {
  const db = await getDb();
  // RETURNING + rows.length é portável (pglite não expõe rowCount).
  const r = await db.query<{ id: number }>(`DELETE FROM dev_feedback WHERE id = $1 RETURNING id`, [id]);
  return r.rows.length > 0;
}

export const FEEDBACK_VALID_STATUS = VALID_STATUS;
