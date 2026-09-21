// Guard dos 4 SLOTS do header compartilhado (T7.1, spec 102).
//
// O aceite 1 de T7.1 é sobre o CSS (`grid-template-columns` com 4 faixas) e vive em
// `styles.contract.test.ts`. Este arquivo cobre o outro lado do mesmo contrato: quantos
// filhos DIRETOS o grid recebe de fato. Os dois juntos é que provam o alinhamento —
// 4 faixas com 5 filhos empurra o 5º para uma coluna implícita, que foi exatamente o
// defeito de T3.5e (a faixa de sessão saía da área visível no celular).
//
// Por que um arquivo novo e não mais um caso em `Header.acesso.test.tsx`: aquele guarda
// a regra de ACESSO (o que é público e o que é de sessão), e misturar contagem
// estrutural ali faria os dois assuntos quebrarem juntos sem dizer qual regrediu.
//
// Ambiente `node` (padrão do pacote): `renderToStaticMarkup` basta para estrutura.
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { Header } from "./Header.js";

vi.mock("@artificio/auth/client", () => ({
  getAccountsOrigin: () => "https://accounts.artificiorpg.com",
  logout: vi.fn(),
  redirectToLogin: vi.fn(),
  useSession: () => ({ user: null, loading: false }),
}));

const usuario = {
  id: "u1",
  email: "teste@artificiorpg.com",
  name: "Fulano de Tal",
  role: "user" as const,
  avatar: null,
};

/** Tags vazias do HTML: não abrem nível e não entram na contagem de profundidade. */
const VAZIAS = new Set(["img", "br", "input", "meta", "link", "line", "path", "circle", "polygon", "hr"]);

/**
 * Filhos DIRETOS de `.artificio-header-main`, na ordem do documento.
 *
 * Varre as tags contando profundidade, como o guard equivalente do `site`
 * (`apps/site/src/components/SiteHeader.estrutura.test.tsx`). Nenhum parser de HTML
 * resolve a partir daqui, e a posição no HTML é o que o exemplo oficial do Astro usa.
 */
function filhosDoGrid(html: string): string[] {
  const inicio = html.indexOf('class="artificio-header-main"');
  expect(inicio, "`.artificio-header-main` ausente no HTML").toBeGreaterThan(-1);
  const grid = html.slice(inicio);

  const re = /<(\/?)([a-zA-Z-]+)\b[^>]*?(\/?)>/g;
  re.lastIndex = grid.indexOf(">") + 1;

  const filhos: string[] = [];
  let profundidade = 0;
  let m: RegExpExecArray | null;

  while ((m = re.exec(grid)) !== null) {
    const [tagCompleta, barraFinal, nome, autoFechada] = m;
    if (VAZIAS.has(nome) || autoFechada === "/") continue;

    if (barraFinal === "/") {
      if (profundidade === 0) break; // fechou o próprio grid
      profundidade--;
      continue;
    }

    if (profundidade === 0) {
      const classe = /class="([^"]*)"/.exec(tagCompleta)?.[1] ?? "";
      filhos.push(`${nome}.${classe}`);
    }
    profundidade++;
  }

  return filhos;
}

const todasAsFerramentas = {
  showSearch: true,
  onSearch: () => undefined,
  showChangelog: true,
  onOpenChangelog: () => undefined,
  showThemeToggle: true,
} as const;

describe("slots do grid do header (T7.1)", () => {
  it("entrega os 4 filhos na ordem [☰público] [marca] [nav] [ferramentas] [sessão]", () => {
    // A `nav` é o 3º filho e some por `display: none` em ≤860px — ela NÃO consome
    // slot no mobile, por isso as 4 faixas cobrem os 4 controles visíveis lá.
    const html = renderToStaticMarkup(
      <Header {...todasAsFerramentas} sessionOverride={{ user: null, loading: false }} />,
    );

    expect(filhosDoGrid(html)).toEqual([
      "button.artificio-nav-toggle",
      "a.artificio-brand",
      "nav.",
      "div.artificio-header-tools",
      "div.artificio-session",
    ]);
  });

  it("o hambúrguer público vem ANTES da marca no documento", () => {
    // Ordem do DOM = ordem do leitor de tela e do Tab. Na tela ele está à esquerda de
    // tudo; resolver isso por `order` do CSS divergiria as duas ordens.
    const html = renderToStaticMarkup(
      <Header {...todasAsFerramentas} sessionOverride={{ user: null, loading: false }} />,
    );

    expect(html.indexOf("artificio-nav-toggle")).toBeLessThan(html.indexOf("artificio-brand"));
  });

  it("não ganha filho a mais quando o usuário está logado", () => {
    // O avatar e o menu entram DENTRO de `.artificio-session`, não como irmãos dela.
    // Um filho a mais aqui cai em coluna implícita e empurra a sessão para fora da
    // tela — o defeito de T3.5e.
    const html = renderToStaticMarkup(
      <Header {...todasAsFerramentas} sessionOverride={{ user: usuario, loading: false }} />,
    );

    expect(filhosDoGrid(html)).toHaveLength(5);
  });

  it("perde a coluna de ferramentas quando o app não liga nenhuma", () => {
    // Caso do `links` sem busca: 4 filhos, e o grid tem faixa `auto` que colapsa.
    const html = renderToStaticMarkup(
      <Header sessionOverride={{ user: null, loading: false }} />,
    );

    expect(filhosDoGrid(html)).toEqual([
      "button.artificio-nav-toggle",
      "a.artificio-brand",
      "nav.",
      "div.artificio-session",
    ]);
  });

  it("a busca embutida entra como filho do grid, e vai para a 2ª linha no mobile", () => {
    // Caso do `downloads`. Ela é o 5º filho no desktop; em ≤860px o CSS a manda para
    // `grid-row: 2` com `grid-column: 1 / -1`, então também não disputa slot lá.
    const html = renderToStaticMarkup(
      <Header
        showSearch
        onSearchChange={() => undefined}
        sessionOverride={{ user: null, loading: false }}
      />,
    );

    expect(filhosDoGrid(html)).toContain("label.artificio-header-search");
  });

  it("conta 6 filhos com busca EMBUTIDA mais ferramentas — a combinação do `downloads`", () => {
    // O caso que faltava, e por onde o defeito passou: o teste acima passa só
    // `showSearch` + `onSearchChange`, sem changelog nem tema, e asserta `toContain`
    // em vez de contar. A combinação real do `downloads`
    // (`apps/downloads/frontend/src/components/AppShell.tsx:142-154`) entrega SEIS
    // filhos, e o `.artificio-nav-toggle` é `display: none` no desktop — 5 itens
    // visíveis. Com 4 faixas o 5º caía em linha implícita e levava
    // `.artificio-session`, medido em produção como `x:24 y:60`.
    //
    // A faixa extra vive em `styles.css` (`[data-has-search="true"]`, 5 faixas) e tem
    // guard do outro lado em `styles.contract.test.ts`. Este arquivo trava a CONTAGEM
    // de filhos; os dois juntos é que provam o alinhamento.
    //
    // `glossario`, `links` e `mesas` passam as mesmas três ferramentas e NÃO têm este
    // filho a mais: eles usam `onSearch` (a lupa), que entra dentro de
    // `.artificio-header-tools`.
    const html = renderToStaticMarkup(
      <Header
        showSearch
        onSearchChange={() => undefined}
        showChangelog
        onOpenChangelog={() => undefined}
        showThemeToggle
        sessionOverride={{ user: null, loading: false }}
      />,
    );

    expect(filhosDoGrid(html)).toEqual([
      "button.artificio-nav-toggle",
      "a.artificio-brand",
      "nav.",
      "label.artificio-header-search",
      "div.artificio-header-tools",
      "div.artificio-session",
    ]);
  });

  it("a lupa NÃO cria filho a mais: ela mora nas ferramentas", () => {
    // O contraste que explica por que só o `downloads` quebrava. Mesmas três
    // ferramentas do caso acima, trocando `onSearchChange` por `onSearch`: 5 filhos,
    // 4 visíveis no desktop, dentro das faixas da regra base.
    const html = renderToStaticMarkup(
      <Header {...todasAsFerramentas} sessionOverride={{ user: null, loading: false }} />,
    );

    const filhos = filhosDoGrid(html);
    expect(filhos).not.toContain("label.artificio-header-search");
    expect(filhos).toHaveLength(5);
  });
});
