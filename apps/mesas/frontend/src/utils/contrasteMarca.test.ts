import { readdirSync, readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/** Todo `.ts`/`.tsx` sob `raiz`, sem depender de glob do runner. */
function listarFontes(raiz: string): string[] {
  const achados: string[] = [];
  for (const entrada of readdirSync(raiz, { withFileTypes: true })) {
    const caminho = resolve(raiz, entrada.name);
    if (entrada.isDirectory()) achados.push(...listarFontes(caminho));
    else if (/\.tsx?$/.test(entrada.name)) achados.push(caminho);
  }
  return achados;
}

/**
 * Guarda de contraste dos botões sólidos de marca (spec 103, T3.1/T3.2).
 *
 * O teste CALCULA a razão a partir do valor real do token em
 * `packages/ui/src/styles.css`, em vez de conferir se a classe cita
 * `--brand-solid`. A diferença importa: conferir o nome do token passaria
 * mesmo se o pacote trocasse o valor por um que reprova, que é justamente o
 * modo como este defeito nasceu — `--color-artificio-orange` é nome correto
 * apontando para `#ff5722`, que mede 3,16:1 com branco.
 *
 * Mesmo padrão de `TableEditor.test.tsx:428` ("a casca empilha ACIMA do header
 * do AppShell"): ler os dois arquivos e comparar o par medido, para que uma
 * mudança no pacote falhe aqui e aponte a causa.
 */

const CSS_PACOTE = resolve(process.cwd(), '../../../packages/ui/src/styles.css');

/**
 * Comentários FORA antes de qualquer casamento.
 *
 * O arquivo do pacote documenta a própria estrutura de tema em prosa
 * (`:root = light, [data-theme="dark"] = dark`, linhas 134-136), e a primeira
 * versão deste teste recortou o bloco escuro nessa MENÇÃO em vez de no seletor
 * real da linha 294 — `--brand-solid` ficou fora dos dois blocos e não
 * resolveu. Mesma pegadinha registrada em `TableEditor.test.tsx:444`.
 */
const css = readFileSync(CSS_PACOTE, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

/**
 * Luminância relativa, definição normativa do WCAG 2.x. Não é o brilho
 * percebido nem a média dos canais: o verde pesa 0,7152 e o azul 0,0722.
 */
function luminancia(hex: string): number {
  const n = hex.replace('#', '');
  const canais = [0, 2, 4].map((i) => Number.parseInt(n.slice(i, i + 2), 16) / 255);
  const linear = canais.map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function razao(a: string, b: string): number {
  const [claro, escuro] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
  return (claro + 0.05) / (escuro + 0.05);
}

/**
 * Valor final de um token, seguindo `var(--outro)` até chegar a um literal.
 *
 * `--brand-solid` no tema escuro é `var(--artificio-brand)`, e comparar contra
 * a string `var(...)` não mediria cor nenhuma.
 */
function resolverToken(nome: string, bloco: string): string {
  const declaracoes = [...bloco.matchAll(/--([a-z0-9-]+):\s*([^;]+);/g)];
  const achar = (alvo: string): string | null => {
    for (let i = declaracoes.length - 1; i >= 0; i -= 1) {
      if (declaracoes[i][1] === alvo) return declaracoes[i][2].trim();
    }
    return null;
  };

  let valor = achar(nome);
  for (let salto = 0; salto < 5 && valor?.startsWith('var('); salto += 1) {
    const referido = /var\(\s*--([a-z0-9-]+)/.exec(valor)?.[1];
    if (!referido) break;
    // Alias pode apontar para token declarado ANTES do bloco (`:root` global),
    // então a busca volta ao arquivo inteiro.
    valor = achar(referido) ?? resolverTokenGlobal(referido);
  }

  if (!valor || !/^#[0-9a-f]{6}$/i.test(valor)) {
    throw new Error(`token --${nome} não resolveu para cor literal: ${valor}`);
  }
  return valor;
}

function resolverTokenGlobal(nome: string): string | null {
  const achado = [...css.matchAll(new RegExp(`--${nome}:\\s*([^;]+);`, 'g'))];
  return achado.length > 0 ? achado[0][1].trim() : null;
}

/** O bloco `:root` (tema claro) e o bloco do tema escuro, separados. */
function blocos(): { claro: string; escuro: string } {
  const inicioEscuro = css.search(/\[data-theme=["']?dark["']?\]|\.dark\b/);
  expect(inicioEscuro).toBeGreaterThan(0);
  return { claro: css.slice(0, inicioEscuro), escuro: css.slice(inicioEscuro) };
}

describe('contraste do par sólido de marca (WCAG 2.2 AA)', () => {
  // 4,5:1 e não 3:1: medido, o rótulo dos dois botões é `text-sm
  // font-semibold` — 14px/600. "Texto grande" no WCAG 2.2 começa em 18,66px
  // bold ou 24px, e `@theme` do app não sobrescreve `--text-sm`.
  const AA_TEXTO_NORMAL = 4.5;

  const { claro, escuro } = blocos();

  it.each([
    ['claro', claro],
    ['escuro', escuro],
  ])('repouso passa AA no tema %s', (_tema, bloco) => {
    const fundo = resolverToken('brand-solid', bloco);
    const texto = resolverToken('brand-solid-fg', bloco);
    expect(razao(fundo, texto)).toBeGreaterThanOrEqual(AA_TEXTO_NORMAL);
  });

  it.each([
    ['claro', claro],
    ['escuro', escuro],
  ])('hover passa AA no tema %s', (_tema, bloco) => {
    // Hover que escurece o fundo sem checar contraste é como o estado
    // interativo passa a reprovar sozinho (achado de review, PR #305).
    const fundo = resolverToken('brand-solid-hover', bloco);
    const texto = resolverToken('brand-solid-fg', bloco);
    expect(razao(fundo, texto)).toBeGreaterThanOrEqual(AA_TEXTO_NORMAL);
  });

  it('o laranja de marca puro com branco REPROVA — é por isso que o par existe', () => {
    // Ancora o motivo da correção. Se algum dia `--artificio-brand` clarear o
    // suficiente para passar, este teste falha e avisa que o par sólido virou
    // desnecessário, em vez de ninguém reparar.
    const marca = resolverTokenGlobal('artificio-brand');
    expect(marca).toBe('#ff5722');
    expect(razao(marca!, '#ffffff')).toBeLessThan(AA_TEXTO_NORMAL);
  });

  it('a função de razão bate com os pares de referência do WCAG', () => {
    // Sem isto, um erro na fórmula deixaria os testes acima verdes por acidente.
    expect(razao('#000000', '#ffffff')).toBeCloseTo(21, 1);
    expect(razao('#ffffff', '#ffffff')).toBeCloseTo(1, 5);
    expect(razao('#767676', '#ffffff')).toBeCloseTo(4.54, 1);
  });
});

describe('nenhum fundo sólido de marca voltou ao laranja cru', () => {
  it('varredura do app inteiro', () => {
    // A spec nomeava 2 botões; a varredura achou **22** com o mesmo par
    // medido, todos no `mesas` (14 com `text-white`, 1 com `text-[var(--fg)]`
    // — 2,80:1 no tema escuro — e 7 herdando a cor do ancestral). Este teste
    // existe para que o 23º não entre: é a varredura que falhou em achar os
    // outros 20 quando só os 2 estavam escritos na spec.
    const raiz = resolve(__dirname, '..');
    const arquivos = listarFontes(raiz);
    expect(arquivos.length).toBeGreaterThan(100);

    const infratores: string[] = [];
    for (const arquivo of arquivos) {
      if (arquivo.endsWith('contrasteMarca.test.ts')) continue;
      readFileSync(arquivo, 'utf8')
        .split(/\r?\n/)
        .forEach((linha, i) => {
          // Fundo SÓLIDO (sem sufixo `/NN` de opacidade): com opacidade o
          // contraste depende do que está atrás, e o cálculo é outro.
          if (!/bg-\[var\(--color-artificio-orange\)\](?!\/)/.test(linha)) return;
          // Barra de progresso não tem texto por cima: o critério ali é o 3:1
          // de componente de interface, contra a trilha, não o 4,5:1 de texto.
          if (/transition-\[width\]/.test(linha)) return;
          infratores.push(`${relative(raiz, arquivo)}:${i + 1}`);
        });
    }
    expect(infratores).toEqual([]);
  });
});

describe('os dois botões do catálogo usam o par, não o laranja cru', () => {
  it.each([
    ['#btn-anunciar-mesa-home', '../pages/CatalogoPage.tsx', 'btn-anunciar-mesa-home'],
    ['#catalog-search-submit', '../components/CatalogFiltersBar.tsx', 'catalog-search-submit'],
  ])('%s', (_nome, arquivo, id) => {
    const fonte = readFileSync(resolve(__dirname, arquivo), 'utf8');
    // Recorta só o VALOR do `className` da tag que tem este `id`. A tag inteira
    // não serve: o comentário que documenta a correção cita `text-white` em
    // prosa, e a asserção negativa casaria no comentário em vez da classe.
    const classe = new RegExp(`id="${id}"[\\s\\S]{0,1600}?className="([^"]+)"`)
      .exec(fonte)?.[1];
    expect(classe).toBeTruthy();
    expect(classe).toContain('bg-[var(--brand-solid)]');
    expect(classe).toContain('text-[var(--brand-solid-fg)]');
    expect(classe).toContain('hover:bg-[var(--brand-solid-hover)]');
    // `text-white` fixo é o defeito: no tema escuro o par vira laranja + navy,
    // e branco fixo reprovaria justamente ali.
    expect(classe).not.toContain('text-white');
    expect(classe).not.toContain('bg-[var(--color-artificio-orange)]');
  });
});
