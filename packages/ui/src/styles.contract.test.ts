import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const styles = readFileSync(new URL("./styles.css", import.meta.url), "utf8");

function cssRule(selector: string) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return styles.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`))?.[1] ?? "";
}

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
