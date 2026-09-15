// Guard da ESTRUTURA do header do `site` (spec 102, correção do aceite 16 em 2026-09-14).
//
// O defeito: `SiteHeader.astro` abria `<header>` + `.artificio-header-main` e a ilha
// devolvia um Fragment com nav/ferramentas/sessão dentro. Ao hidratar, o Astro injeta um
// `<style>` e um `<script>` como IRMÃOS do `<astro-island>`, no mesmo pai — os dois viram
// itens do grid. Medido no HTML do beta: `<style>`, `<script>`, `<astro-island>`, nav e
// tools dentro do grid, 5 itens para as 4 colunas de `packages/ui/src/styles.css` (3 em
// ≤860px), com as ferramentas públicas fora da área visível no celular. Relato do
// mantenedor: "não tem changelog nem mudar para escuro".
//
// O `<astro-island>` em si é transparente — o Astro emite
// `astro-island,astro-slot,astro-static-slot{display:contents}` sozinho. Quem ocupava
// coluna a mais eram o `<style>`/`<script>` injetados e a subnav derramada na barra.
//
// POR QUE A CONTAINER API, e não `renderToStaticMarkup` do React: o defeito vive na
// FRONTEIRA entre o `.astro` e o `.tsx`. Renderizar só o componente React não produz
// `<astro-island>` nem as tags injetadas — o teste passaria verde com o header quebrado,
// que foi o que aconteceu com `tsc`, `eslint` e os 184 testes anteriores.
// `container.renderToString(SiteHeader)` renderiza o `.astro` REAL, com tudo em volta.
// Bônus medido: dispensa `@types/react-dom` no `apps/site`, que exigiria regenerar o
// `pnpm-lock.yaml` (+26/−23 com poda de `@babel/core` — padrão de E008, `deploy-flow` §2).
//
// `getContainerRenderer` vem do ROOT de `@astrojs/react` porque a versão instalada é a
// 5.0.7; o entrypoint `@astrojs/react/container-renderer` só existe a partir do Astro 7.
// Ao atualizar, trocar o import — o root passa a emitir warning de deprecação.
//
// Ambiente `node`, sem jsdom: o ambiente jsdom do vitest substitui globais e quebra a
// invariante `new TextEncoder().encode("") instanceof Uint8Array` de que o esbuild
// depende (vitest#5685/#4043), com "Invariant violation" antes de qualquer asserção.
// Medido aqui em 2026-09-15. Como nenhum parser de HTML resolve a partir de `apps/site`,
// as asserções são por POSIÇÃO no HTML — que é também o padrão do exemplo oficial do
// Astro (`examples/container-with-vitest`).
import { getContainerRenderer } from "@astrojs/react";
import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { loadRenderers } from "astro:container";
import { beforeAll, describe, expect, it } from "vitest";
import SiteHeader from "./SiteHeader.astro";

/** HTML do header, do `<div class="artificio-header-main">` até o fim. */
let grid = "";
/** Offset, dentro de `grid`, do `</div>` que fecha o próprio grid. */
let fimDoGrid = -1;
/** HTML completo do header renderizado. */
let html = "";

/** Filhos DIRETOS do grid, na ordem: as tags de profundidade 1. */
let filhos: { tag: string; classe: string }[] = [];

beforeAll(async () => {
  const renderers = await loadRenderers([getContainerRenderer()]);
  const container = await AstroContainer.create({ renderers });
  html = await container.renderToString(SiteHeader);

  const inicio = html.indexOf('class="artificio-header-main"');
  expect(inicio, "`.artificio-header-main` ausente no HTML renderizado").toBeGreaterThan(-1);
  grid = html.slice(inicio);

  /* Varre as tags contando profundidade para achar os filhos de nível 1 e onde o grid
     fecha. `<img>`, `<line>` e afins são vazias e não entram na contagem; o SVG dos
     botões é ignorado porque nunca aparece em profundidade 1. */
  const VAZIAS = new Set(["img", "br", "input", "meta", "link", "line", "path", "circle", "polygon", "hr"]);
  const re = /<(\/?)([a-zA-Z-]+)\b[^>]*?(\/?)>/g;
  let profundidade = 0;
  let m: RegExpExecArray | null;
  filhos = [];

  // Pula a própria tag de abertura do grid: a varredura começa depois do primeiro `>`.
  re.lastIndex = grid.indexOf(">") + 1;

  while ((m = re.exec(grid)) !== null) {
    const [tagCompleta, barraFinal, nome, autoFechada] = m;
    if (VAZIAS.has(nome) || autoFechada === "/") continue;

    if (barraFinal === "/") {
      if (profundidade === 0) {
        fimDoGrid = m.index;
        break;
      }
      profundidade--;
      continue;
    }

    if (profundidade === 0) {
      filhos.push({
        tag: nome,
        classe: /class="([^"]*)"/.exec(tagCompleta)?.[1] ?? "",
      });
    }
    profundidade++;
  }

  expect(fimDoGrid, "não achei o `</div>` que fecha o grid").toBeGreaterThan(0);
});

/** Um marcador está dentro do grid? */
const dentroDoGrid = (marcador: string): boolean => {
  const pos = grid.indexOf(marcador);
  return pos > -1 && pos < fimDoGrid;
};

describe("estrutura do header do site (contrato do grid)", () => {
  it("não deixa <style> nem <script> injetados dentro do grid", () => {
    // A regressão original: com o grid aberto no `.astro`, as tags que o Astro injeta ao
    // hidratar eram filhas diretas dele e ocupavam coluna.
    expect(dentroDoGrid("<style")).toBe(false);
    expect(dentroDoGrid("<script")).toBe(false);
    expect(dentroDoGrid("<astro-island")).toBe(false);
  });

  it("o grid tem exatamente os 4 filhos que o CSS declara em colunas", () => {
    // `grid-template-columns: auto 1fr auto auto` (packages/ui/src/styles.css).
    // Um filho a mais cai em coluna implícita; um a menos desalinha o resto.
    expect(filhos.map((f) => `${f.tag}.${f.classe}`)).toEqual([
      "a.artificio-brand",
      "nav.",
      "div.artificio-header-tools",
      "div.artificio-session",
    ]);
  });

  it("ferramentas públicas ficam no grid, com changelog, busca e tema", () => {
    expect(dentroDoGrid("artificio-header-tools")).toBe(true);
    expect(dentroDoGrid('aria-label="Novidades"')).toBe(true);
    expect(dentroDoGrid('aria-label="Buscar"')).toBe(true);
    // O ThemeToggle vem de `packages/ui` e é o 3º botão da coluna.
    const tools = grid.slice(grid.indexOf("artificio-header-tools"), fimDoGrid);
    expect((tools.match(/<button/g) ?? []).length).toBeGreaterThanOrEqual(3);
  });

  it("subnav é IRMÃ do grid, não filha", () => {
    // `.artificio-header` é `flex-direction: column` e a subnav tem `border-top`: ela é
    // 2ª LINHA do header. Dentro do grid viraria mais uma coluna.
    expect(grid.indexOf("artificio-subnav")).toBeGreaterThan(fimDoGrid);
  });

  it("mantém os 11 links do nav no HTML servido (aceite 13)", () => {
    // Vêm do SSR, antes da hidratação — é o que o crawler lê. `client:only` quebraria
    // isto em silêncio.
    expect((html.match(/artificio-nav-link/g) ?? []).length).toBe(11);
  });

  it("a ilha é dona do <header>, e o island fica por fora dele", () => {
    // Mesmo padrão de `apps/links`, o único outro header por ilha do repo.
    expect(html.indexOf("<astro-island")).toBeLessThan(html.indexOf('class="artificio-header"'));
    expect(html.indexOf("</header>")).toBeLessThan(html.indexOf("</astro-island>"));
  });
});
