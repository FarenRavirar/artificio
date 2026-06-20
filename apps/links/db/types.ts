// Schema Kysely do módulo links (espelha o padrão de apps/mesas/backend/src/db/types.ts).
// Tabela única `groups`: curados (seed) + comunidade (sugestões moderadas). Ver spec 013 / migration_001.
import type { ColumnType, Generated, Insertable, Selectable, Updateable } from "kysely";

export type GroupKind = "group" | "channel";
export type GroupCategory = "artificio" | "tematicos" | "parceiros" | "comunidade";
export type GroupStatus = "pending" | "active" | "archived" | "rejected";
export type GroupSource = "curated" | "community";

export interface GroupsTable {
  id: Generated<string>;
  name: string;
  /** slug SEO da página publicada (/grupo/<slug>); nulo enquanto pending */
  slug: string | null;
  /** até 3 slugs referenciando group_tags */
  tags: Generated<string[]>;
  description: string | null;
  /** regras próprias do grupo (sanitizado), além da descrição */
  rules: string | null;
  invite_url: string;
  kind: Generated<GroupKind>;
  category: GroupCategory;
  is_adult: Generated<boolean>;
  logo_url: string | null;
  logo_public_id: string | null;
  status: Generated<GroupStatus>;
  source: Generated<GroupSource>;
  submitted_by: string | null;
  submitted_email: string | null;
  submitted_name: string | null;
  sort_order: Generated<number>;
  /** quando o admin aprovou (ativou); created_at = quando foi enviado */
  approved_at: ColumnType<Date | null, string | null | undefined, string | null>;
  created_at: ColumnType<Date, never, never>;
  updated_at: ColumnType<Date, never, string | undefined>;
}

export type Group = Selectable<GroupsTable>;
export type NewGroup = Insertable<GroupsTable>;
export type GroupUpdate = Updateable<GroupsTable>;

// Vocabulário de tags gerido pelo admin (criar/editar/remover). Grupos referenciam por slug.
export interface GroupTagsTable {
  id: Generated<string>;
  slug: string;
  label: string;
  sort_order: Generated<number>;
  created_at: ColumnType<Date, never, never>;
  updated_at: ColumnType<Date, never, string | undefined>;
}

export type GroupTag = Selectable<GroupTagsTable>;
export type NewGroupTag = Insertable<GroupTagsTable>;
export type GroupTagUpdate = Updateable<GroupTagsTable>;

export interface Database {
  groups: GroupsTable;
  group_tags: GroupTagsTable;
}
