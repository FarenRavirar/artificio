import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Quem prioriza a capa, e quem não prioriza (spec 103, T2; achados de review da
 * PR #328).
 *
 * `loading`/`fetchpriority` saem de `tableImageAttrs`, e o helper já tem teste
 * de unidade em `tableImage.test.ts`. O que este arquivo guarda é a outra
 * metade, que o helper não pode decidir: QUAL consumidor passa `priority`.
 * Errar esse lado não quebra teste nenhum e não aparece em build — some no
 * Lighthouse, semanas depois. Foram três erros do mesmo tipo numa PR só:
 *
 * - `TableCard` sem prop, então o primeiro card do catálogo saía `lazy`;
 * - `TableHero` com `priority: true` fixo, então toda mesa da lista do perfil
 *   saía `eager`+`high`;
 * - `MestreFeaturedTable` priorizada com a justificativa de ser "a primeira
 *   imagem da página", medido falso.
 *
 * A asserção é sobre a FONTE e não sobre o DOM renderizado porque a decisão que
 * importa está na chamada do consumidor: montar `MestrePage` inteira exigiria
 * react-query, router e `useAuth` para provar uma linha de JSX.
 */

const SRC = resolve(__dirname, '..');

function fonte(caminho: string): string {
  // Comentários fora antes de casar: os próprios blocos que documentam estas
  // decisões citam `priority` em prosa, e a asserção negativa casaria neles em
  // vez do código. Mesma pegadinha de `contrasteMarca.test.ts:33-41`.
  return readFileSync(resolve(SRC, caminho), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

describe('prioridade da capa por consumidor', () => {
  it('catálogo prioriza o primeiro card e só ele', () => {
    const src = fonte('pages/CatalogoPage.tsx');
    expect(src).toMatch(/<TableCardComponent[\s\S]{0,200}?priority=\{idx === 0\}/);
  });

  it('`TableCardComponent` recebe a prioridade de fora, com default `false`', () => {
    // Sem o default, um consumidor que esqueça a prop herdaria `undefined` e o
    // comportamento dependeria do helper, não da página.
    const src = fonte('components/TableCard.tsx');
    expect(src).toMatch(/priority = false/);
    expect(src).toMatch(/tableImageAttrs\([^)]*priority[^)]*\)/);
    expect(src).not.toMatch(/priority:\s*true/);
  });

  it('`TableHero` não prioriza por conta própria', () => {
    // Fixo aqui, a lista do perfil baixa todas as capas de uma vez.
    const src = fonte('features/table/components/TableHero.tsx');
    expect(src).toMatch(/priority = false/);
    expect(src).not.toMatch(/priority:\s*true/);
  });

  it('a rota da mesa é a única que pede prioridade ao `TableHero`', () => {
    expect(fonte('pages/MesaPage.tsx')).toMatch(/<TableHero[^>]*priority/);
    // Lista de mesas do perfil: um herói por mesa, nenhum é LCP.
    expect(fonte('features/master/components/MasterTables.tsx')).not.toMatch(/priority/);
  });

  it('a mesa destacada do perfil não é priorizada — o hero vem antes dela', () => {
    // `MestrePage.tsx` renderiza `MestreHero` (banner + avatar) e só depois do
    // grupo "Sobre" chega à seção de mesas.
    expect(fonte('components/mestre/MestreFeaturedTable.tsx')).not.toMatch(/priority/);
  });
});

describe('`sizes` descreve a caixa real, não o container', () => {
  it('a capa destacada declara meia coluna no desktop', () => {
    // `grid-template-columns: 1fr 1fr` em `MestrePage.css:441`, uma coluna só
    // em `max-width: 768px` (`:589`). Declarar os 1200px do container fazia o
    // navegador escolher a variante de 1200w para uma caixa de 600px.
    const src = fonte('components/mestre/MestreFeaturedTable.tsx');
    expect(src).toMatch(/min-width: 1200px\) 600px/);
    expect(src).toMatch(/min-width: 769px\) 50vw/);
    expect(src).not.toMatch(/min-width: 1200px\) 1200px/);
  });

  it('o CSS do card destacado segue em duas colunas — a premissa do `sizes`', () => {
    // Se alguém trocar a grade para uma coluna, o `sizes` acima passa a mentir
    // no outro sentido. Este teste falha junto e aponta os dois arquivos.
    const css = readFileSync(resolve(SRC, 'pages/MestrePage.css'), 'utf8').replace(
      /\/\*[\s\S]*?\*\//g,
      '',
    );
    expect(css).toMatch(
      /\.mestre-featured-table-link\s*\{[^}]*grid-template-columns:\s*1fr 1fr/,
    );
    expect(css).toMatch(/@media \(max-width: 768px\)/);
  });
});
