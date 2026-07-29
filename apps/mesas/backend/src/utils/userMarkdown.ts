export {
  sanitizeNullableUserMarkdown,
  sanitizeOptionalUserMarkdown,
  sanitizeUserMarkdown,
} from '@artificio/content-editor/sanitize';

import { sanitizeOptionalUserMarkdown } from '@artificio/content-editor/sanitize';

type TableMarkdownFields = {
  description?: string | null;
  rules_notes?: string | null;
  synopsis?: string | null;
  style_text?: string | null;
  listing_excerpt?: string | null;
  technical_requirements?: string | null;
  billing_text?: string | null;
  ddal_rules_notes?: string | null;
  synopsis_narrative?: string | null;
  benefits_text?: string | null;
  table_gm_bio?: string | null;
};

export function sanitizeTableMarkdownFields<T extends TableMarkdownFields>(table: T): T {
  return {
    ...table,
    description: sanitizeOptionalUserMarkdown(table.description),
    rules_notes: sanitizeOptionalUserMarkdown(table.rules_notes),
    synopsis: sanitizeOptionalUserMarkdown(table.synopsis),
    style_text: sanitizeOptionalUserMarkdown(table.style_text),
    listing_excerpt: sanitizeOptionalUserMarkdown(table.listing_excerpt),
    technical_requirements: sanitizeOptionalUserMarkdown(table.technical_requirements),
    billing_text: sanitizeOptionalUserMarkdown(table.billing_text),
    ddal_rules_notes: sanitizeOptionalUserMarkdown(table.ddal_rules_notes),
    synopsis_narrative: sanitizeOptionalUserMarkdown(table.synopsis_narrative),
    benefits_text: sanitizeOptionalUserMarkdown(table.benefits_text),
    table_gm_bio: sanitizeOptionalUserMarkdown(table.table_gm_bio),
  };
}
