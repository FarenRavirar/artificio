import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// O Vitest transforma `import.meta.url` durante o bundle; `process.cwd()` é a
// raiz do app e já é o padrão exercitado por TableEditor.test.tsx.
const pageDir = resolve(process.cwd(), 'src/pages');
const pageSource = readFileSync(resolve(pageDir, 'MestrePage.tsx'), 'utf8');
const pageCss = readFileSync(resolve(pageDir, 'MestrePage.css'), 'utf8');

describe('MestrePage — ritmo vertical das seções (spec 099 C3)', () => {
  it('agrupa o conteúdo posterior ao hero num único fluxo', () => {
    expect(pageSource).toContain('<div className="mestre-section-flow">');
  });

  it('remove as margens inline que criavam vãos diferentes', () => {
    expect(pageSource).not.toContain("style={{ marginTop: '3rem' }}");
  });

  it('aplica 48px a partir da régua compartilhada, sem junção 0px', () => {
    const flowRule = pageCss.match(/\.mestre-section-flow\s*\{[^}]+\}/s)?.[0] ?? '';

    expect(flowRule).toContain('display: flex');
    expect(flowRule).toContain('flex-direction: column');
    expect(flowRule).toContain('gap: calc(var(--space-6) * 2)');
  });
});
