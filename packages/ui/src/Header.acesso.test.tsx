// Guarda dos aceites 14/15 da spec 102 T3.5e: a regra de ACESSO do header.
//
// "Ferramenta pública à esquerda; a sessão — e a porta para ela — à direita."
// O `Header.test.tsx` ao lado cobre só busca embutida vs. lupa legada, e passava verde
// com os três itens públicos dentro de `.artificio-session` — que é justamente o defeito
// que T3.5e corrigiu. Sem esta suíte, mover qualquer um deles de volta não quebra nada.
//
// Ambiente `node` (padrão do pacote): `renderToStaticMarkup` basta para provar ESTRUTURA.
// A exclusão mútua dos painéis, que depende de clique, está em `Header.paineis.test.tsx`
// com jsdom — separada para não pagar DOM nesta.
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { Header } from "./Header.js";

vi.mock("@artificio/auth/client", () => ({
  getAccountsOrigin: () => "https://accounts.artificiorpg.com",
  logout: vi.fn(),
  redirectToLogin: vi.fn(),
  useSession: () => ({ user: null, loading: false }),
}));

const deslogado = { user: null, loading: false };

/** Recorta o HTML da faixa de sessão para asserção de conteúdo. Fecha na `</div>` que
 *  encerra o wrapper — basta para os itens diretos, que é o que o aceite 15 lista. */
function faixaDeSessao(html: string): string {
  const inicio = html.indexOf('class="artificio-session"');
  expect(inicio).toBeGreaterThan(-1);
  return html.slice(inicio, inicio + 1200);
}

const comFerramentas = {
  showSearch: true,
  onSearch: () => undefined,
  showChangelog: true,
  onOpenChangelog: () => undefined,
  showThemeToggle: true,
} as const;

describe("regra de acesso do header (T3.5e)", () => {
  it("renderiza as ferramentas públicas FORA da faixa de sessão", () => {
    const html = renderToStaticMarkup(
      <Header {...comFerramentas} sessionOverride={deslogado} />,
    );

    const tools = html.indexOf("artificio-header-tools");
    const session = html.indexOf('class="artificio-session"');

    expect(tools).toBeGreaterThan(-1);
    expect(tools).toBeLessThan(session);
  });

  it("não deixa busca, changelog nem tema dentro de `.artificio-session`", () => {
    const html = renderToStaticMarkup(
      <Header {...comFerramentas} sessionOverride={deslogado} />,
    );
    const faixa = faixaDeSessao(html);

    expect(faixa).not.toContain('aria-label="Buscar"');
    // "Novidades", não "Changelog": T7.2 unificou o rótulo com o do `apps/site` ao
    // extrair `ChangelogButton`. É o mesmo controle, e o nome acessível é o que o
    // usuário ouve — dois nomes para um botão é a divergência por app que a regra de
    // compartilhado do `AGENTS.md` trata como dívida.
    expect(faixa).not.toContain('aria-label="Novidades"');
    expect(faixa).not.toContain("artificio-theme-toggle");
  });

  it('mantém o botão "Entrar" na direita — é a porta da sessão, não ferramenta', () => {
    // Correção do mantenedor: "na direita tem que ter ao menos o login. login é
    // publico, senão não tem como o cara entrar". Aplicar a regra ao pé da letra o
    // mandaria para a esquerda e tiraria o login do lugar onde o usuário o procura.
    const html = renderToStaticMarkup(
      <Header {...comFerramentas} sessionOverride={deslogado} />,
    );

    expect(faixaDeSessao(html)).toContain("artificio-login-button");
  });

  it("mantém o `menu-toggle` na direita, na extremidade da barra", () => {
    const html = renderToStaticMarkup(
      <Header {...comFerramentas} sessionOverride={deslogado} />,
    );

    expect(faixaDeSessao(html)).toContain("artificio-menu-toggle");
  });

  it("não deixa `actions` na barra — ele vive dentro do painel de sessão (T7.3)", () => {
    // Era o inverso até T7.2: `actions` renderizava como `.artificio-header-actions`,
    // IRMÃO do avatar na faixa, e a fazia medir 72px em vez de 40px — o estouro de 2px
    // em 320. A decisão do mantenedor na F7 é que notificação mora dentro do menu de
    // quem está logado; `actions` inteiro desceu junto, porque é slot extensível.
    //
    // Aqui o render é DESLOGADO, então `actions` não aparece em lugar nenhum. Onde ele
    // renderiza quando há sessão é assunto de `Header.sessao.test.tsx`, que abre o painel
    // com clique real — `renderToStaticMarkup` nunca vê o menu aberto.
    const html = renderToStaticMarkup(
      <Header
        {...comFerramentas}
        actions={<span data-testid="acao-do-app" />}
        sessionOverride={deslogado}
      />,
    );

    expect(html).not.toContain("artificio-header-actions");
    expect(html).not.toContain("acao-do-app");
  });

  it("não cria a coluna de ferramentas quando o app não liga nenhuma", () => {
    // Container vazio deixaria uma coluna sobrando no grid de 4 do header.
    const html = renderToStaticMarkup(<Header sessionOverride={deslogado} />);

    expect(html).not.toContain("artificio-header-tools");
  });

  it("cria a coluna com apenas uma ferramenta ligada (caso do `accounts`, só tema)", () => {
    const html = renderToStaticMarkup(
      <Header showThemeToggle sessionOverride={deslogado} />,
    );

    expect(html).toContain("artificio-header-tools");
  });

  it("não duplica a lupa legada quando a busca embutida está ligada", () => {
    const html = renderToStaticMarkup(
      <Header
        showSearch
        onSearch={() => undefined}
        onSearchChange={() => undefined}
        sessionOverride={deslogado}
      />,
    );

    expect(html).toContain('type="search"');
    // Asserção pelo BOTÃO, não por `aria-label="Buscar"`: esse rótulo é o default do
    // `searchLabel` e pertence legitimamente ao input embutido. Procurá-lo solto reprova
    // o render correto — foi o que esta suíte fez na primeira versão.
    expect(html).not.toContain('class="artificio-header-action" aria-label="Buscar"');
    // E a coluna NÃO nasce vazia: com busca embutida a lupa é desligada, e sem outra
    // ferramenta ligada não há o que pôr nela. A primeira versão desta suíte assertava
    // `<div class="artificio-header-tools"></div>`, congelando como esperado o container
    // vazio que deixava uma coluna sobrando no grid (achado do CodeRabbit, PR #321).
    expect(html).not.toContain("artificio-header-tools");
  });

  it("não cria a coluna vazia quando só a busca embutida está ligada", () => {
    // Caso real do `mesas`: busca embutida e nenhuma outra ferramenta.
    const html = renderToStaticMarkup(
      <Header showSearch onSearchChange={() => undefined} sessionOverride={deslogado} />,
    );

    expect(html).toContain('type="search"');
    expect(html).not.toContain("artificio-header-tools");
  });

  it("cria a coluna quando a busca é embutida mas há changelog", () => {
    const html = renderToStaticMarkup(
      <Header
        showSearch
        onSearchChange={() => undefined}
        showChangelog
        onOpenChangelog={() => undefined}
        sessionOverride={deslogado}
      />,
    );

    expect(html).toContain("artificio-header-tools");
    expect(html).toContain('aria-label="Novidades"');
  });

  it("não cria a coluna quando `showChangelog` vem sem handler", () => {
    // O filho só renderiza com `onOpenChangelog`; a condição do wrapper espelha isso.
    const html = renderToStaticMarkup(
      <Header showChangelog sessionOverride={deslogado} />,
    );

    expect(html).not.toContain("artificio-header-tools");
  });
});
