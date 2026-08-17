// @vitest-environment jsdom

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * O `CommunityModerationWorkspace` usa utilitárias do Tailwind (`space-y-4`,
 * `p-5`, `rounded border`, `sr-only`), mas **nenhum app consumidor declara
 * `@source` para `packages/comments`** — os três apontam só para
 * `packages/ui/src`. O Tailwind não vê estes arquivos e não emite as regras,
 * então `styles.css` carrega um fallback local para cada uma.
 *
 * Este teste existe porque o fallback falhou em silêncio uma vez (achado de
 * review, PR #270): as regras estavam escritas como descendência
 * (`.artificio-moderation-workspace .p-5`), mas `space-y-4` e `p-5` ficam no
 * MESMO elemento que a classe raiz, e um seletor de descendência nunca casa o
 * elemento consigo mesmo. O CSS parecia correto, o build passava, e o padding
 * do wrapper simplesmente não era aplicado nos hosts sem Tailwind.
 *
 * Nada além de um teste pega isso: não é erro de sintaxe, não é erro de tipo, e
 * nos hosts onde o Tailwind gera as classes o defeito fica invisível.
 */

// Caminho a partir do cwd do pacote, e não de `import.meta.url`: sob o ambiente
// jsdom a URL do módulo não tem esquema `file:` e `fileURLToPath` recusa.
const CSS = readFileSync(join(process.cwd(), 'src', 'styles.css'), 'utf8');

/** As utilitárias que o componente aplica na PRÓPRIA raiz do workspace. */
const NA_RAIZ = ['space-y-4', 'p-5'] as const;
/** As que aparecem em descendentes. */
const EM_DESCENDENTE = ['space-y-3', 'p-3', 'rounded', 'border'] as const;

/**
 * Extrai os seletores do fallback direto do CSS publicado, para o teste medir o
 * arquivo real e não uma cópia que envelhece.
 */
function seletoresDoFallback(utilitaria: string): string[] {
  const escapada = utilitaria.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`^([^{\\n]*\\.${escapada})(?=[\\s,{:>])`, 'gm');
  return [...CSS.matchAll(regex)].map((m) => m[1].trim().replace(/,$/, ''));
}

describe('fallback de utilitárias do workspace de moderação', () => {
  it('a estrutura do componente põe a classe raiz e as utilitárias no mesmo elemento', () => {
    // Espelha `CommunityModerationWorkspace.tsx:250` e `:315`. Se a marcação
    // mudar, este teste é o lugar de descobrir.
    document.body.innerHTML = `
      <div class="artificio-moderation-workspace space-y-4 p-5">
        <div class="space-y-3"><fieldset class="rounded border p-3"></fieldset></div>
      </div>`;

    const raiz = document.querySelector('.artificio-moderation-workspace');
    expect(raiz?.classList.contains('p-5')).toBe(true);
    expect(raiz?.classList.contains('space-y-4')).toBe(true);
  });

  it('alcança as utilitárias que ficam na própria raiz', () => {
    document.body.innerHTML = `
      <div class="artificio-moderation-workspace space-y-4 p-5">
        <div class="space-y-3"><fieldset class="rounded border p-3"></fieldset></div>
      </div>`;

    for (const utilitaria of NA_RAIZ) {
      const seletores = seletoresDoFallback(utilitaria);
      expect(seletores.length, `sem regra de fallback para .${utilitaria}`).toBeGreaterThan(0);

      const alcanca = seletores.some((s) => document.querySelectorAll(s).length > 0);
      expect(
        alcanca,
        `.${utilitaria} está na raiz do workspace, mas nenhum seletor do fallback a alcança: ${seletores.join(' | ')}`,
      ).toBe(true);
    }
  });

  it('continua alcançando as utilitárias em descendentes', () => {
    document.body.innerHTML = `
      <div class="artificio-moderation-workspace space-y-4 p-5">
        <div class="space-y-3"><fieldset class="rounded border p-3"></fieldset></div>
      </div>`;

    for (const utilitaria of EM_DESCENDENTE) {
      const seletores = seletoresDoFallback(utilitaria);
      expect(seletores.length, `sem regra de fallback para .${utilitaria}`).toBeGreaterThan(0);

      const alcanca = seletores.some((s) => document.querySelectorAll(s).length > 0);
      expect(alcanca, `.${utilitaria} não é alcançada: ${seletores.join(' | ')}`).toBe(true);
    }
  });

  it('não vaza para fora do workspace, onde colidiria com o Tailwind do host', () => {
    document.body.innerHTML = `<div class="p-5 space-y-4 rounded border"></div>`;

    for (const utilitaria of [...NA_RAIZ, ...EM_DESCENDENTE]) {
      for (const seletor of seletoresDoFallback(utilitaria)) {
        expect(
          document.querySelectorAll(seletor).length,
          `${seletor} alcança elemento fora do workspace`,
        ).toBe(0);
      }
    }
  });

  it('esconde `sr-only` mesmo no `<output>`, que fica fora do wrapper', () => {
    // `CommunityModerationWorkspace.tsx:307` monta o anúncio fora do workspace.
    document.body.innerHTML = `<output class="sr-only">anúncio</output>`;

    const seletores = seletoresDoFallback('sr-only');
    const alcanca = seletores.some((s) => document.querySelectorAll(s).length > 0);
    expect(alcanca, `nenhum seletor de sr-only alcança o <output>: ${seletores.join(' | ')}`).toBe(true);
  });
});
