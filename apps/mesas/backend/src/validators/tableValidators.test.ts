import { updateTableSchema } from './tableValidators.js';

describe('updateTableSchema — Markdown de usuário', () => {
  it.each([
    'description',
    'rules_notes',
    'synopsis',
    'style_text',
    'listing_excerpt',
    'technical_requirements',
    'synopsis_narrative',
    'benefits_text',
    'table_gm_bio',
  ] as const)('remove HTML executável de %s antes da escrita', (field) => {
    const result = updateTableSchema.parse({
      [field]: '**Markdown** <script>alert(1)</script><img src=x onerror=alert(2)>',
    });

    expect(result[field]).toContain('**Markdown**');
    expect(result[field]).not.toMatch(/script|onerror|<img|alert\(/i);
  });
});
