import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = (relativePath: string) => readFileSync(new URL(relativePath, import.meta.url), 'utf8');

describe('spec 099 phase F visual contracts', () => {
  it('uses the shared checkbox in both direct-link controls', () => {
    const avatar = source('../components/AvatarField.tsx');
    const uploader = source('../components/ImageUploader.tsx');

    expect(avatar).toContain("import { Button, Checkbox } from '@artificio/ui'");
    expect(uploader).toContain("import { Checkbox } from '@artificio/ui'");
    expect(avatar).toContain('<Checkbox');
    expect(uploader).toContain('<Checkbox');
    expect(avatar).not.toContain('type="checkbox"');
    expect(uploader).not.toContain('type="checkbox"');
  });

  it('keeps the GM and editor URL links at least 24 pixels high', () => {
    const tableCard = source('../components/TableCard.tsx');
    const linksCss = source('../components/LinksManager.css');

    expect(tableCard).toContain('inline-flex min-h-6');
    expect(linksCss.match(/\.link-item-url\s*\{[^}]*\}/s)?.[0]).toContain('min-height: 24px');
  });

  it('uses shared primitives and spacing without local button or spinner copies', () => {
    const page = source('./ProfileEditPage.tsx');
    const css = source('./ProfileEditPage.css');

    expect(page).toContain("import { Button, LoadingState } from '@artificio/ui'");
    expect(css).toContain('var(--space-');
    expect(css).not.toMatch(/\.btn-(?:view-public-profile|connect-discord|disconnect-discord|avatar-action)/);
    expect(css).not.toContain('@keyframes spin');
  });

  // A F5 apagou `.spinner`, `.spinner-small` e `@keyframes spin` de
  // `ProfileEditPage.css`. `UserSystemsSelector` usava `.spinner-small` sem
  // definir a regra no proprio CSS: so funcionava porque o Vite injeta o CSS da
  // pagina globalmente. Removida a regra, a div virou 0x0 -- sem erro, sem teste
  // vermelho, so o indicador sumindo. O contrato abaixo cobre a classe de
  // defeito: quem consome um spinner tem de usar o do pacote.
  it('leaves no orphan spinner class behind in the editor tree', () => {
    const editorCss = [
      source('./ProfileEditPage.css'),
      source('../components/UserSystemsSelector.css'),
    ].join(' ');
    const consumers = [
      source('./ProfileEditPage.tsx'),
      source('../components/UserSystemsSelector.tsx'),
    ].join(' ');

    expect(editorCss).not.toMatch(/\.spinner(-small)?\s*\{/);
    expect(consumers).not.toMatch(/className="spinner(-small)?"/);
    expect(consumers).toContain('artificio-button-spinner');
  });

  // `App.tsx` nao usa lazy: todo CSS de rota entra no MESMO bundle, entao classe
  // sem prefixo e global de fato. Medido no bundle construido: havia 3
  // definicoes de `.spinner` colidindo (24px sem borda do lucide, 40px e 48px
  // com borda), e quem vencia era ordem de import -- ninguem escolheu isso. O
  // contrato cobre o app inteiro, nao so o editor.
  it('keeps no unprefixed global spinner anywhere in the app', () => {
    const cssFiles = import.meta.glob('../**/*.css', { eager: true, query: '?raw', import: 'default' });

    // Glob vazio passaria mudo e deixaria de vigiar o app sem ninguem notar.
    expect(Object.keys(cssFiles).length).toBeGreaterThan(10);

    for (const [path, content] of Object.entries(cssFiles)) {
      expect(`${path}: ${content as string}`).not.toMatch(/(^|\})\s*\.spinner(-small)?\s*\{/);
      expect(`${path}: ${content as string}`).not.toMatch(/@keyframes\s+spin\s*\{/);
    }
  });

  it('uses the shared 40px control scale and bounds years to its answer size', () => {
    const fields = source('../components/mestre/editor/GmProfileFields.tsx');
    const css = source('./ProfileEditPage.css');

    expect(fields).toContain('<TextInput');
    expect(fields).toContain('className="experience-years-input"');
    expect(css.match(/\.experience-years-input\s*\{[^}]*\}/s)?.[0]).toContain('max-width: 8rem');
    expect(css).toContain('min-height: 40px');
  });
});
