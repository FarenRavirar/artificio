import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const styles = readFileSync(new URL("./styles.css", import.meta.url), "utf8");

function cssRule(selector: string) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return styles.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`))?.[1] ?? "";
}

/** Corpo do `@media (max-width: 860px)`, onde o header colapsa. */
const media860 = (() => {
  const inicio = styles.indexOf("@media (max-width: 860px)");
  if (inicio < 0) return "";
  // Casa a chave do próprio `@media`, contando aninhamento até fechá-la.
  let profundidade = 0;
  for (let i = styles.indexOf("{", inicio); i < styles.length; i++) {
    if (styles[i] === "{") profundidade++;
    else if (styles[i] === "}" && --profundidade === 0) return styles.slice(inicio, i);
  }
  return "";
})();

/** Regra de um seletor DENTRO do media de 860px. */
function regraNoMedia860(selector: string) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return media860.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`))?.[1] ?? "";
}

describe("header em ≤860px", () => {
  it("esconde o nome do usuário SEM tirá-lo da árvore de acessibilidade", () => {
    // O `<span class="artificio-user-name">` é o único texto dentro do
    // `<button aria-haspopup="menu">` do avatar (`Header.tsx`, `SiteHeaderIsland.tsx`);
    // a `<img>` ao lado tem `alt=""` por ser decorativa. Com `display: none` o botão
    // fica sem nome acessível — WCAG 4.1.2, achado do Codex na PR #322.
    //
    // Este guard existe porque NENHUM teste de comportamento pega a regressão:
    // `Header.paineis.test.tsx` acha o avatar por `getByRole("button", { name: /fulano/i })`
    // — que depende exatamente desse nome acessível — e passa verde com a regra errada,
    // porque jsdom não aplica media query.
    const regra = regraNoMedia860(".artificio-user-name");

    expect(regra).not.toBe("");
    expect(regra).not.toContain("display: none");
    expect(regra).not.toContain("visibility: hidden");
    // Ocultação visual: sai da tela, permanece no acessível.
    expect(regra).toContain("position: absolute");
    expect(regra).toContain("clip-path: inset(50%)");
  });

  it("colapsa o grid do header para os 4 slots", () => {
    // [☰público] [marca] [🔍] [☰sessão] — T7.1, spec 102. A nav inline some (regra
    // abaixo). Antes de T7.1 eram 3 colunas (`1fr auto auto`) e o header media 394px
    // logado / 406px deslogado, estourando em 360, 375 e 390 (achado P1 do Codex na
    // PR #322). Com `auto 1fr auto auto` só a marca é elástica: 290px em 320.
    expect(regraNoMedia860(".artificio-header-main")).toContain("grid-template-columns: auto 1fr auto auto");
  });

  it("faz a soma das faixas caber em 320px de verdade", () => {
    // ⚠️ O guard que faltava, e sem o qual a aritmética do comentário mentiu (achado
    // P1 do Codex na PR #323). A 1ª versão contou 40px para a faixa de sessão sem
    // reduzir o `min-width: 96px` da regra base: a soma real era 346px e o header
    // estourava 26px em 320 — a largura que T7.1 existe para suportar.
    //
    // Cada parcela é medida do CSS, não do comentário. Se alguém subir um piso, a
    // soma estoura aqui antes de estourar na tela.
    const px = (regra: string, prop: string) =>
      Number(new RegExp(`${prop}:\\s*(\\d+)px`).exec(regra)?.[1] ?? NaN);

    // Sem comentários: a regra base dos hambúrgueres tem um `/* ... */` ENTRE os dois
    // seletores, e passá-lo dentro do seletor para `cssRule` não casa nada (errei assim
    // na 1ª versão deste guard, e a parcela virou NaN).
    const semComentarios = styles.replace(/\/\*[\s\S]*?\*\//g, "");
    const toggle = px(
      /\.artificio-nav-toggle,\s*\.artificio-menu-toggle\s*\{([^}]*)\}/.exec(semComentarios)?.[1] ?? "",
      "min-width",
    );
    const pisoSessao = px(regraNoMedia860(".artificio-session"), "min-width");
    const acao = px(cssRule(".artificio-header-action"), "min-width");
    // `padding: 8px 16px` — o lateral é o 2º valor, e é ele que entra na soma.
    const lateral = Number(
      /padding:\s*\d+px\s+(\d+)px/.exec(regraNoMedia860(".artificio-header-main"))?.[1] ?? NaN,
    );
    const avatar = px(cssRule(".artificio-avatar"), "width");

    // Nenhuma parcela pode ter vindo de uma leitura que falhou: NaN passaria calado
    // por qualquer comparação `<=`.
    expect(
      [toggle, pisoSessao, acao, lateral, avatar].some(Number.isNaN),
      `parcela não lida do CSS: toggle=${toggle} piso=${pisoSessao} acao=${acao} lateral=${lateral} avatar=${avatar}`,
    ).toBe(false);

    expect(pisoSessao, "min-width da faixa de sessão em ≤860px").toBe(40);
    expect(acao, "min-width do botão de ação (a lupa)").toBe(40);

    // A faixa de sessão mede o CONTEÚDO, não o `min-width` (achado P1 do Codex em
    // `fc5a4fe`). Até T7.2 o conteúdo era sino + avatar = 72px, e a soma dava 322px.
    //
    // T7.3 tirou dali tudo que não é a porta da sessão: `actions` — o sino, e o que mais
    // o módulo injetar — foi para dentro do painel. Sobrou o avatar de 32px, abaixo do
    // piso de 40px, que volta a ser quem manda na faixa.
    //
    // ⚠️ Somar `acao + avatar` de novo aqui congelaria o estado ANTERIOR. Este guard mede
    // o CSS; quem prova que `actions` não voltou para a barra é `Header.sessao.test.tsx`,
    // que é sobre a árvore.
    const sessao = Math.max(pisoSessao, avatar);

    // ☰público + marca + lupa + sessão + 3 gaps + padding dos dois lados.
    const MARCA_MINIMA = 90;
    const GAP = 16;
    const soma = toggle + MARCA_MINIMA + acao + sessao + 3 * GAP + 2 * lateral;

    // T7.3 FECHOU O ESTOURO: o teto era 322 e caiu para 320, a largura de tela alvo.
    // Era um teto "conhecido" porque a faixa media sino + avatar; agora `actions` vive no
    // painel e ela mede só o avatar, abaixo do piso de 40px.
    //
    // O número fica aqui, e não numa promessa em comentário, porque foi um comentário
    // otimista que deixou passar os dois estouros anteriores.
    const LARGURA_ALVO = 320;
    expect(
      soma,
      `soma das faixas = ${soma}px, acima dos ${LARGURA_ALVO}px de tela alvo. A faixa de sessão voltou a carregar conteúdo além do avatar?`,
    ).toBeLessThanOrEqual(LARGURA_ALVO);
    // O seletor é multi-linha no CSS (`> nav` e `.artificio-subnav` em linhas separadas),
    // então o recorte vai do primeiro seletor até a chave, tolerando o que houver entre eles.
    const navEscondida = media860.match(
      /\.artificio-header-main > nav,\s*\.artificio-subnav\s*\{([^}]*)\}/,
    )?.[1] ?? "";
    expect(navEscondida).toContain("display: none");
  });
});

// T7.4 (spec 102) — o chrome escurece por TEMA, não só por prop.
//
// Antes: só `[data-variant="dark"]` pintava header/footer, e o atributo era escrito por
// JS. No `site` isso só acontecia depois do `client:idle`, enquanto o corpo já havia
// escurecido pelo script inline que roda antes da primeira pintura — o FOUC relatado
// pelo mantenedor ("o site sempre carrega o branco e troca para o escuro, a cada F5").
//
// Nenhum teste de comportamento pega uma regressão aqui: jsdom não aplica CSS, e o
// atributo continuaria sendo escrito do mesmo jeito. Por isso o guard é sobre o TEXTO
// das regras, como o de `.artificio-user-name` acima.
// T7.1 (spec 102) — os 4 slots do header em ≤860px.
//
// jsdom não aplica media query nem `:has()`, então NENHUM teste de comportamento pega
// uma regressão aqui: os guards são sobre o texto das regras, como o de
// `.artificio-user-name`. O que eles NÃO provam é pixel — isso é o smoke visual.
describe("4 slots do header em ≤860px (T7.1)", () => {
  // `regraNoMedia860` e `cssRule` JÁ escapam o seletor que recebem — passar escape
  // manual aqui casa nada e o guard vira falso-verde. Errei assim na 1ª versão destes
  // testes; eles falharam com "expected '' to contain", que é a assinatura do seletor
  // que não casou (a regra existia no CSS).
  it("expõe SÓ a busca na barra; changelog e tema descem para o painel", () => {
    // Aceite 2 de T7.1. A regra é por exclusão para que ferramenta nova também desça:
    // o default seguro numa barra de 320px é sair, não entrar.
    const escondidos = regraNoMedia860('.artificio-header-tools > *:not([aria-label="Buscar"])');
    expect(escondidos).toContain("display: none");
  });

  it("esconde o container de ferramentas quando não sobrou busca nele", () => {
    // Caso real do `accounts`, que liga só o tema: sem isto fica um `<div>` vazio
    // cobrando os 2×16px de `gap` do grid — 32px dos 30px de folga em 320px.
    const vazio = regraNoMedia860('.artificio-header-tools:not(:has([aria-label="Buscar"]))');
    expect(vazio).toContain("display: none");
  });

  it("mostra o hambúrguer público em ≤860px, e nenhum no desktop", () => {
    // Aceite 1/3: o público é o 1º slot. No desktop ambos somem porque a nav inline
    // dá conta.
    //
    // Sem `cssRule` na regra base: há um COMENTÁRIO entre `.artificio-nav-toggle,` e
    // `.artificio-menu-toggle {`, e nenhum recorte por seletor atravessa isso. A
    // asserção é sobre o texto do arquivo, que é o que de fato precisa estar lá.
    expect(
      /\.artificio-nav-toggle,[\s\S]{0,120}?\.artificio-menu-toggle\s*\{[^}]*display: none/.test(styles),
      "regra base: os dois hambúrgueres têm de nascer `display: none`",
    ).toBe(true);

    expect(regraNoMedia860(".artificio-nav-toggle")).toContain("display: inline-flex");
  });

  it("NÃO mostra dois hambúrgueres idênticos — o de sessão espera T7.3", () => {
    // Os dois chamam `toggleNav` hoje (medido em `Header.tsx`): o da direita só passa
    // a ser painel de sessão em T7.3. Mostrar ambos daria ao usuário dois controles
    // com o mesmo efeito, um ao lado do outro, e o 4º slot já tem o avatar/"Entrar".
    //
    // Este guard é TEMPORÁRIO por construção: T7.3 o substitui ao reativar o botão.
    //
    // ⚠️ Esconder o `menu-toggle` só é seguro porque TODO consumidor deste CSS tem o
    // `.artificio-nav-toggle`. O `apps/site` tem header próprio e não tinha: ficou sem
    // controle de navegação nenhum em ≤860px (P1 do Codex na PR #323). O guard daquele
    // lado é `SiteHeader.estrutura.test.tsx`; ao mexer nesta regra, conferir lá também.
    expect(regraNoMedia860(".artificio-menu-toggle")).toContain("display: none");
  });

  it("distingue a subnav do nav de projetos por SUPERFÍCIE, não só por fonte", () => {
    // Aceite 1 de T7.5. Até aqui a subnav só redefinia `font-size`, `min-height` e
    // `padding`: dois navs do mesmo desenho empilhados, e nada dizia que o de cima cruza
    // subdomínios enquanto o de baixo anda dentro do módulo. Tamanho sozinho lê como
    // hierarquia tipográfica, não como "outro tipo de navegação".
    //
    // O guard é sobre o que DIFERENCIA, não sobre o valor exato: trocar o tom do fundo é
    // decisão de design e não deve quebrar teste; remover a diferença, sim.
    const subnav = cssRule(".artificio-subnav");
    expect(subnav).toContain("background:");

    // O item ativo se marca por PÍLULA, não pela "aba" de `border-bottom` do nav de
    // projetos — dois sublinhados laranja a poucos pixels um do outro não distinguem
    // "estou no módulo Mesas" de "estou no Catálogo dentro dele".
    const ativo = cssRule('.artificio-subnav .artificio-nav-link[aria-current="page"]');
    expect(ativo).toContain("background:");
    expect(ativo).toContain("border-bottom-color: transparent");
  });

  it("dá à subnav um par escuro — `--artificio-canvas` NÃO vira por tema", () => {
    // `--artificio-canvas`, como `--artificio-muted`/`--artificio-line`/`--artificio-surface`,
    // é declarado UMA vez no `:root` e o bloco `[data-theme="dark"]` não o redefine (quem
    // vira é a pilha `--surface`/`--fg`/`--line`). Sem o par abaixo, o fundo novo da
    // subnav sairia `#f6f7fa` cruzando o header navy no escuro.
    //
    // As DUAS portas: o guard genérico de `data-variant` (abaixo, T7.4) já reprova regra
    // que escureça só por prop; este reprova a AUSÊNCIA da regra, que aquele não vê.
    expect(
      styles.includes(
        ':root[data-theme="dark"] .artificio-header:not([data-variant="light"]) .artificio-subnav',
      ),
      "a subnav ganhou fundo próprio sem par no tema escuro",
    ).toBe(true);
  });

  it("mantém o desktop em 4 colunas — T7.1 não mexe nele", () => {
    // O grid de `:root` é anterior a T7.1 e continua `auto 1fr auto auto`: brand, nav,
    // ferramentas, sessão. Coincidência de valor, papéis diferentes.
    expect(cssRule(".artificio-header-main")).toContain("grid-template-columns: auto 1fr auto auto");
  });
});

describe("chrome escuro por tema (T7.4)", () => {
  /** Toda regra cujo seletor menciona `[data-variant="dark"]`. */
  const regrasDeVariant = [
    ...styles.matchAll(/([^}]*\[data-variant="dark"\][^{]*)\{/g),
  ].map((m) => m[1]);

  it("pareia TODA regra de `data-variant=dark` com a de `data-theme=dark`", () => {
    // Uma regra que escureça só por prop deixa aquele detalhe claro no tema escuro —
    // exatamente o defeito que o dropdown do avatar tinha (fundo branco sobre navy).
    expect(regrasDeVariant.length).toBeGreaterThan(0);

    const semPar = regrasDeVariant.filter(
      (seletor) => !seletor.includes('data-theme="dark"'),
    );
    expect(semPar, `regras que só escurecem por prop:\n${semPar.join("\n")}`).toEqual([]);
  });

  it("deixa `variant=\"light\"` VENCER o tema escuro", () => {
    // É o que mantém a prop útil: header claro sobre um documento escuro. Sem o
    // `:not()`, a porta do tema venceria e a prop viraria decoração.
    const porTema = [...styles.matchAll(/:root\[data-theme="dark"\] \.artificio-(header|footer)([^{,]*)/g)];
    expect(porTema.length).toBeGreaterThan(0);
    for (const [trecho] of porTema) {
      expect(trecho, `sem escape de \`variant="light"\`: ${trecho}`).toContain(
        ':not([data-variant="light"])',
      );
    }
  });

  it("pareia TODA regra de `data-theme=dark` do CHROME com a de `data-variant=dark`", () => {
    // O sentido INVERSO do guard acima, e o buraco que deixou passar o achado do
    // CodeRabbit na PR #323: as 5 regras do dropdown escureciam só por tema, então um
    // consumidor com `variant="dark"` sob documento CLARO tinha header navy e menu
    // branco dentro. O guard anterior varre "variant sem tema" e não via isso.
    //
    // Escopo: só o chrome (header/footer e o que vive dentro deles). Regras de tema de
    // componentes de página não têm por que seguir a prop do header.
    const cssSemComentarios = styles.replace(/\/\*[\s\S]*?\*\//g, "");
    const porTema = [
      ...cssSemComentarios.matchAll(
        /:root\[data-theme="dark"\]\s+\.artificio-(?:header|footer)[^{]*\{/g,
      ),
    ].map((m) => m[0]);

    expect(porTema.length).toBeGreaterThan(0);

    // Cada regra de tema do chrome tem de citar o alvo também pela prop. A asserção é
    // sobre o BLOCO de seletores (eles vêm agrupados por vírgula), não regra a regra.
    const semPar = porTema.filter((bloco) => !bloco.includes('[data-variant="dark"]'));
    expect(
      semPar,
      `regras de chrome que escurecem só por tema:\n${semPar.join("\n")}`,
    ).toEqual([]);
  });

  it("dá ao dropdown do avatar um fundo que vira por tema", () => {
    // Ele nasce dentro do header e usava `--artificio-surface` (`#ffffff` FIXO, sem
    // versão em `[data-theme=dark]`), então abria um retângulo branco sobre o navy.
    // Só aparece depois do clique no avatar — nenhum smoke o pegava.
    // `cssRule` não serve aqui: ele casa `seletor\s*\{`, e este seletor é o PRIMEIRO de
    // um grupo — vem seguido de vírgula, não de chave. Foi o que quebrou este guard ao
    // parear a regra com a porta da prop.
    const regra = /\.artificio-header:not\(\[data-variant="light"\]\) \.artificio-usermenu-dropdown\s*,[^{]*\{([^}]*)\}/
      .exec(styles)?.[1] ?? "";
    expect(regra).not.toBe("");
    expect(regra).toContain("--artificio-dark-surface");
  });

  it("faz o menu do avatar honrar `variant=\"light\"`, como o resto do header", () => {
    // Achado do Codex na PR #323 (P2): as regras do dropdown casavam
    // `:root[data-theme="dark"] .artificio-usermenu-*` SOLTO, sem passar pelo header.
    // Num consumidor com `variant="light"` sob documento escuro — caso suportado por
    // `HeaderProps` — o header ficava claro e o menu dentro dele, escuro.
    // Duas armadilhas, as duas medidas aqui em 2026-09-15:
    //
    // 1. `\s+\.artificio-usermenu` tem de vir IMEDIATAMENTE após o `:root[...]`. Um
    //    `[^{]*` no meio atravessa o `.artificio-header:not(...)` e casa a versão
    //    CORRIGIDA — o teste reprovaria a própria correção que deve aprovar.
    // 2. Varredura sobre o CSS cru casa dentro de COMENTÁRIO. O comentário acima destas
    //    regras cita o seletor errado como exemplo, e a regex enganchava nele. Por isso
    //    os comentários saem antes: um guard que lê texto tem de ler só o que o
    //    navegador lê.
    const cssSemComentarios = styles.replace(/\/\*[\s\S]*?\*\//g, "");
    const soltas = [
      ...cssSemComentarios.matchAll(/:root\[data-theme="dark"\]\s+\.artificio-usermenu[^{,]*\{/g),
    ].map((m) => m[0]);

    expect(
      soltas,
      `regra de menu sem passar pelo header:\n${soltas.join("\n")}`,
    ).toEqual([]);
  });

  it("alterna a marca por CSS, e no pacote — não em JS nem por app", () => {
    // `Header`/`Footer` emitem as DUAS `<img>`; escolher em JS exigiria saber o tema
    // antes de hidratar, que é o que não existe quando o escuro vem do documento.
    expect(styles).toContain(':root[data-theme="dark"] .artificio-header:not([data-variant="light"]) .artificio-brand-logo.logo-navy');
  });

  it("faz a ocultação da marca VENCER o `display: block` das imagens", () => {
    // ⚠️ O guard que faltava (achado P1 do Codex na PR #323). A 1ª versão assertava
    // `cssRule(".logo-neg")` — que só prova que a regra EXISTE, não que ela ganha.
    //
    // `.logo-neg` sozinho tem especificidade (0,1,0), igual a `.artificio-brand-logo`
    // e `.artificio-footer-logo`, que declaram `display: block` DEPOIS no arquivo e
    // venciam pela ordem da cascata. As duas marcas renderizavam no tema claro: a do
    // header ia de 90px para 180px e o total batia 380px, estourando os 320px que
    // T7.1 existe para caber — e o guard antigo passava verde.
    //
    // A regra passou a casar a classe da IMAGEM junto, subindo para (0,2,0). Este
    // teste trava as duas pontas: a especificidade e a ausência da forma frágil.
    const semComentarios = styles.replace(/\/\*[\s\S]*?\*\//g, "");

    // A forma frágil não pode voltar: `.logo-neg`/`.logo-navy` como seletor SOZINHO,
    // sem a classe da imagem antes.
    const frageis = [
      ...semComentarios.matchAll(/(^|[,{}\s])\.logo-(?:neg|navy)\s*[,{]/gm),
    ].map((m) => m[0].trim());
    expect(
      frageis,
      `seletor de marca sem a classe da imagem (perde para o \`display: block\`):\n${frageis.join("\n")}`,
    ).toEqual([]);

    // E a ocultação do tema claro existe na forma forte. Sem `cssRule`: ele escapa o
    // seletor inteiro e não casa grupo multi-linha — a 3ª vez que tropecei nisso neste
    // arquivo, e a razão de os guards daqui usarem regex sobre o texto.
    expect(
      /\.artificio-brand-logo\.logo-neg,\s*\.artificio-footer-logo\.logo-neg\s*\{[^}]*display: none/.test(semComentarios),
      "a marca negativa precisa nascer escondida, na forma que vence a cascata",
    ).toBe(true);
  });
});

describe("shared target-size contracts", () => {
  it("keeps the checkbox itself at least 24 by 24 pixels", () => {
    const rule = cssRule(".artificio-checkbox");

    expect(rule).toContain("min-height: 24px");
    expect(rule).toContain("min-width: 24px");
    // `min-width` sozinho nao segura o alvo: os dois consumidores da F1 poem o
    // checkbox num `inline-flex` ao lado do rotulo, e sem `flex-shrink: 0` o
    // flex encolhe a caixa quando o texto disputa a linha — perdendo os 24px
    // no mobile, que e onde o SC 2.5.8 importa.
    expect(rule).toContain("flex-shrink: 0");
  });

  it("keeps both footer link families at least 24 pixels high", () => {
    expect(cssRule(".artificio-footer-nav-link")).toContain("min-height: 24px");
    expect(cssRule(".artificio-footer-copyright-summary a")).toContain("min-height: 24px");
  });
});

// Paleta de dados (spec 100, D19). Existe separada dos --state-* porque cor de
// série não carrega significado — "visualizações" não é um aviso.
describe("paleta de dados", () => {
  const SERIES = [1, 2, 3, 4] as const;

  // Luminância relativa e razão de contraste (WCAG 2.x), para o teste medir em
  // vez de confiar em número escrito à mão num comentário.
  const lum = (hex: string) => {
    const v = [1, 3, 5].map((i) => {
      const c = parseInt(hex.slice(i, i + 2), 16) / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
  };
  const ratio = (a: string, b: string) => {
    const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  };
  // As séries são declaradas duas vezes no arquivo — uma por tema, na ordem
  // claro → escuro. Coletar por ocorrência é mais robusto que delimitar o bloco
  // `:root`, que tem chaves aninhadas e termina com CRLF.
  const todas = (n: number) => [
    ...styles.matchAll(new RegExp(`--series-${n}:\\s*(#[0-9a-fA-F]{6})`, "g")),
  ].map((m) => m[1]);
  const claro = SERIES.map((n) => todas(n)[0] ?? "");
  const escuro = SERIES.map((n) => todas(n)[1] ?? "");

  it("declara as quatro séries nos dois temas", () => {
    expect(claro.filter(Boolean)).toHaveLength(4);
    expect(escuro.filter(Boolean)).toHaveLength(4);
    // Viram por tema: os valores do claro são escuros demais sobre o navy.
    expect(claro).not.toEqual(escuro);
  });

  it("cada série tem ao menos 3:1 contra o fundo do seu tema", () => {
    // Este é o contraste que faz a barra ser VISTA, e é o que a WCAG 1.4.11 pede
    // para componente gráfico. O contraste entre as séries é outro assunto:
    // tem teto físico e se resolve por textura (ver o teste seguinte).
    for (const c of claro) expect(ratio(c, "#ffffff"), `${c} sobre branco`).toBeGreaterThanOrEqual(3);
    for (const c of escuro) expect(ratio(c, "#1b2a4a"), `${c} sobre navy`).toBeGreaterThanOrEqual(3);
  });

  it("não reusa os tokens semânticos como série de dados", () => {
    // O erro que D19 corrige: success/warning/danger/info significam estado, e
    // warning×info mediam 1,00 entre si — indistinguíveis como barras vizinhas.
    const semanticos = ["#10B981", "#F59E0B", "#EF4444", "#38BDF8"];
    for (const c of [...claro, ...escuro]) {
      expect(semanticos, `${c} é um token semântico`).not.toContain(c.toUpperCase());
    }
  });

  it("dá textura a toda série além da primeira", () => {
    // A distinção NÃO pode depender de cor: daltonismo, escala de cinza e P&B.
    // `cssRule` não serve aqui: ele casa a primeira regra que contém o seletor,
    // e as séries têm um bloco agrupado antes dos individuais. Pega-se do
    // seletor sozinho até o próximo seletor (`\n.`), porque o corpo tem `}`
    // internos vindos de `repeating-linear-gradient(...)`.
    // A ÚLTIMA ocorrência é sempre a regra individual: o bloco agrupado que
    // define o fundo comum vem antes e termina justamente em `.series-4 {`.
    const regraPropria = (sel: string) => {
      const todas = [...styles.matchAll(new RegExp(`\\n\\${sel}\\s*\\{([\\s\\S]*?)\\n\\}`, "g"))];
      return todas.length ? todas[todas.length - 1][1] : "";
    };

    // A série 1 é lisa de propósito — é a linha de base contra a qual se lê.
    expect(regraPropria(".artificio-series-1")).not.toContain("background-image");
    for (const n of [2, 3, 4]) {
      expect(regraPropria(`.artificio-series-${n}`), `série ${n} sem textura`).toContain("background-image");
    }
    // E as duas diagonais não podem ter o mesmo sentido, ou se confundem.
    expect(regraPropria(".artificio-series-2")).toContain("45deg");
    expect(regraPropria(".artificio-series-4")).toContain("-45deg");
  });

  it("dá à textura uma cor que vira por tema", () => {
    // Achado de review (PR #305): o traço era branco fixo, e no tema escuro ele
    // caía sobre séries CLARAS — 1,26 a 1,39 de contraste contra a própria
    // série. A camada criada para distinguir sem depender de cor era a que não
    // se via. O traço inverte com o tema, como as séries.
    const todos = [...styles.matchAll(/--series-pattern:\s*([^;]+);/g)].map((m) => m[1].trim());
    expect(todos, "--series-pattern deve existir nos dois temas").toHaveLength(2);
    expect(todos[0]).toContain("255, 255, 255"); // claro: séries escuras, traço claro
    expect(todos[1]).toContain("11, 18, 32"); // escuro: séries claras, traço escuro

    // Nenhuma regra de série escreve a cor do traço à mão.
    for (const n of [2, 3, 4]) {
      const regra = [...styles.matchAll(new RegExp(`\\n\\.artificio-series-${n}\\s*\\{([\\s\\S]*?)\\n\\}`, "g"))]
        .map((m) => m[1])
        .join("");
      expect(regra, `série ${n} com cor de traço literal`).not.toMatch(/rgba\(\s*255/);
    }
  });

  it("mantém os padrões DISTINTOS em prefers-contrast: more", () => {
    // Achado de review (PR #305): a primeira versão aplicava o mesmo gradiente
    // de 45° às três séries no modo de alto contraste, apagando os pontos da 3
    // e invertendo a diagonal da 4 — devolvendo a distinção à cor sozinha
    // justamente para quem pediu mais contraste.
    const bloco = styles.match(/@media \(prefers-contrast: more\)\s*\{([\s\S]*?)\n\}/)?.[1] ?? "";
    expect(bloco, "bloco de alto contraste não encontrado").not.toBe("");
    // Nenhum seletor agrupado: cada série intensifica o SEU padrão.
    expect(bloco).not.toMatch(/\.artificio-series-\d,\s*\n?\s*\.artificio-series-\d/);
    // A 3 continua pontilhada, a 4 continua na diagonal inversa.
    expect(bloco).toContain("radial-gradient");
    expect(bloco).toContain("-45deg");
  });

  it("dá ao rótulo dentro da barra um foreground que contrasta com a série", () => {
    // Achado de review (PR #305): o valor dentro da barra usava `--fg`, que é
    // quase-preto no claro (2,18–4,07 sobre as séries) e branco no escuro
    // (1,86–3,00) — o número que deveria tornar a barra legível ficava
    // ilegível. `--series-fg` inverte por tema.
    const claroFg = styles.match(/--series-fg:\s*([^;]+);/)?.[1]?.trim() ?? "";
    const todosFg = [...styles.matchAll(/--series-fg:\s*([^;]+);/g)].map((m) => m[1].trim());
    expect(todosFg, "--series-fg deve existir nos dois temas").toHaveLength(2);
    expect(claroFg).toBe("#ffffff");

    // Texto claro sobre série escura (tema claro) e vice-versa: AA nos 8 casos.
    const inkEscuro = "#0b1220";
    for (const c of claro) {
      expect(ratio("#ffffff", c), `texto sobre ${c} no tema claro`).toBeGreaterThanOrEqual(4.5);
    }
    for (const c of escuro) {
      expect(ratio(inkEscuro, c), `texto sobre ${c} no tema escuro`).toBeGreaterThanOrEqual(4.5);
    }
  });
});

// Régua tipográfica (spec 100, Camada 2). O alvo do requisito 5 é ≤6 tamanhos e
// ≤3 pesos POR TELA; estes testes travam a régua na origem, para que as fases
// seguintes tenham a que se ancorar em vez de cada tela inventar a sua.
describe("régua tipográfica", () => {
  const PAPEIS = ["display", "title", "section", "body", "support", "label"] as const;

  it("expõe um utilitário por papel, e todos consomem token", () => {
    for (const papel of PAPEIS) {
      const rule = cssRule(`.artificio-text-${papel}`);
      expect(rule, `.artificio-text-${papel} não existe`).not.toBe("");
      expect(rule).toContain(`var(--text-${papel})`);
      expect(rule).toContain(`var(--leading-${papel})`);
      // Nenhum utilitário escreve valor literal: é o que impede a régua de
      // divergir do token que ela deveria aplicar.
      expect(rule).not.toMatch(/font-size:\s*[0-9]/);
    }
  });

  it("usa cinco tamanhos para seis papéis — section e body dividem 16px", () => {
    const tamanhos = PAPEIS.map(
      (p) => styles.match(new RegExp(`--text-${p}:\\s*([0-9]+px)`))?.[1],
    );
    expect(tamanhos).not.toContain(undefined);
    expect(new Set(tamanhos).size).toBe(5);
    // O que separa os dois papéis de 16px é o peso, não o tamanho.
    expect(cssRule(".artificio-text-section")).toContain("var(--weight-strong)");
    expect(cssRule(".artificio-text-body")).toContain("var(--weight-regular)");
  });

  it("declara três pesos, e os utilitários não usam nenhum outro", () => {
    const pesos = ["regular", "medium", "strong"].map(
      (p) => styles.match(new RegExp(`--weight-${p}:\\s*([0-9]+)`))?.[1],
    );
    expect(pesos).toEqual(["400", "500", "600"]);
    for (const papel of PAPEIS) {
      expect(cssRule(`.artificio-text-${papel}`)).toMatch(/font-weight:\s*var\(--weight-(regular|medium|strong)\)/);
    }
  });

  it("mantém corpo e face condensada separados", () => {
    // Todo papel da régua usa a família de CORPO; a face condensada é opcional e
    // se compõe por cima. Fundir os dois obrigaria todo título grande a ser
    // Oswald, que não é o que o produto quer.
    for (const papel of PAPEIS) {
      expect(cssRule(`.artificio-text-${papel}`)).toContain("var(--artificio-font-sans)");
    }
    expect(cssRule(".artificio-face-display")).toContain("var(--artificio-font-display)");
  });

  it("declara uma única pilha de corpo, com os fallbacks que de fato renderizam", () => {
    // Nenhum app carrega Inter por @font-face (medido na spec 100), então o
    // fallback É o que renderiza. Sem "Segoe UI"/Roboto, Windows e Android caem
    // em faces diferentes das do resto do sistema.
    const sans = styles.match(/--artificio-font-sans:\s*([^;]+);/)?.[1] ?? "";
    expect(sans).toContain("Inter");
    expect(sans).toContain("Segoe UI");
    expect(sans).toContain("Roboto");
  });
});
