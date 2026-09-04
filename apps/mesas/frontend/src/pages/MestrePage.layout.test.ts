import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// O Vitest transforma `import.meta.url` durante o bundle; `process.cwd()` é a
// raiz do app e já é o padrão exercitado por TableEditor.test.tsx.
const pageDir = resolve(process.cwd(), 'src/pages');
const componentDir = resolve(process.cwd(), 'src/components/mestre');
const pageSource = readFileSync(resolve(pageDir, 'MestrePage.tsx'), 'utf8');
const pageCss = readFileSync(resolve(pageDir, 'MestrePage.css'), 'utf8');

// Os componentes que a página monta DENTRO de `.mestre-section-flow`. A margem
// de topo de qualquer um deles soma ao `gap` do container, então checar só o
// fonte da página não prova o ritmo — foi assim que a margem residual de
// `MestreReviewsSection` sobreviveu à primeira versão de C3 (achado de review,
// PR #302), dando 96px antes de Avaliações onde a régua manda 48px.
//
// `MestreInsightsSection` e `MestreRecommendationsSection` saíram da lista na
// spec 100 (T3.3): os dois deixaram de ser renderizados pelo perfil e os
// arquivos foram removidos. Mantê-los aqui quebraria com ENOENT no
// `readFileSync` — e mantê-los como arquivo órfão só para o teste continuar
// verde seria vigiar código morto, que é o erro oposto.
const FLOW_CHILDREN = [
  'MestreBio',
  'MestreHighlights',
  'MestreSellingPoints',
  'MestreContactMethods',
  'MestreVttPlatforms',
  'MestreContactForm',
  'MestreTablesSection',
  'MestreReviewsSection',
  'MestreClosedGroupSection',
  'MestreFinalCta',
] as const;

describe('MestrePage — ritmo vertical das seções (spec 099 C3)', () => {
  it('agrupa o conteúdo posterior ao hero num único fluxo', () => {
    expect(pageSource).toContain('<div className="mestre-section-flow">');
  });

  // D5a/T3.1a: o corpo tem três grupos, não onze blocos irmãos. Sem esta
  // asserção, desfazer o agrupamento não quebraria teste nenhum.
  it.each(['sobre', 'mesas', 'contato'])(
    'monta o grupo %s no fluxo',
    (id) => {
      // Regex, não `toContain` da linha inteira: a montagem quebra em várias
      // linhas quando o grupo ganha props (`hasContent`), e o teste passaria a
      // reprovar por formatação em vez de por ausência do grupo.
      expect(pageSource).toMatch(new RegExp(`<MestreSectionGroup[^]{0,120}id="${id}"`));
    },
  );

  // T3.3: as duas seções saíram do perfil e migraram ao /painel (D4/D14).
  // T3.1a + achado de review (PR #306): o título do grupo é o `h2`; os blocos
  // dentro dele são `h3`. Antes todos eram `h2`, e o `MestreBio` repetia
  // literalmente "Sobre {nome}" logo abaixo do grupo de mesmo nome — cabeçalho
  // duplicado na navegação por leitor de tela e na tela.
  it.each([
    'MestreBio',
    'MestreHighlights',
    'MestreSellingPoints',
    'MestreTablesSection',
    'MestreReviewsSection',
    'MestreClosedGroupSection',
    'MestreContactMethods',
    'MestreContactForm',
    'MestreVttPlatforms',
  ])('%s não usa h2 dentro de um grupo', (component) => {
    const source = readFileSync(resolve(componentDir, `${component}.tsx`), 'utf8');
    expect(source).not.toMatch(/<h2[\s>]/);
  });

  it('não renderiza Insights nem Recomendações no perfil público', () => {
    expect(pageSource).not.toContain('MestreInsightsSection');
    expect(pageSource).not.toContain('MestreRecommendationsSection');
  });

  it('remove as margens inline que criavam vãos diferentes', () => {
    expect(pageSource).not.toContain("style={{ marginTop: '3rem' }}");
  });

  // Só o elemento RAIZ importa: `mt-*` no meio do componente é espaçamento
  // interno (entre um autor e seu comentário, p. ex.) e não afeta o vão entre
  // seções. Recortar a primeira tag depois de cada `return (` isola exatamente
  // o elemento cujo box participa do `gap` do container.
  const rootTagsOf = (source: string): string[] =>
    [...source.matchAll(/return\s*\(\s*(?:\/\/[^\n]*\n\s*)*(<[a-zA-Z][^>]*>)/g)].map(
      (match) => match[1],
    );

  it.each(FLOW_CHILDREN)(
    '%s não carrega margem de topo própria dentro do fluxo',
    (component) => {
      const source = readFileSync(resolve(componentDir, `${component}.tsx`), 'utf8');
      const rootTags = rootTagsOf(source);

      // Se o recorte não achar raiz nenhuma, o teste passaria vazio e deixaria
      // de vigiar o componente sem ninguém notar.
      expect(rootTags.length).toBeGreaterThan(0);

      for (const tag of rootTags) {
        expect(tag).not.toMatch(/marginTop:\s*['"]/);
        expect(tag).not.toMatch(/\bmt-\d/);
      }
    },
  );

  it('aplica 48px a partir da régua compartilhada, sem junção 0px', () => {
    const flowRule = pageCss.match(/\.mestre-section-flow\s*\{[^}]+\}/s)?.[0] ?? '';

    expect(flowRule).toContain('display: flex');
    expect(flowRule).toContain('flex-direction: column');
    expect(flowRule).toContain('gap: calc(var(--space-6) * 2)');
  });
});
