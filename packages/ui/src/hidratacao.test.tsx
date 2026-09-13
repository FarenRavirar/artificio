// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { renderToString } from "react-dom/server";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { useChangelogBadge } from "./hooks.js";
import { ThemeToggle } from "./theme.js";

/**
 * Estes testes travam a REGRA que sustenta o HTML-first: o que o servidor
 * renderiza tem que ser igual ao PRIMEIRO render do cliente.
 *
 * Quando os dois divergem, o React descarta o HTML do servidor e regenera o
 * trecho — o conteúdo que o crawler leu deixa de ser o que o visitante vê, que é
 * o defeito que a spec 102 existe para eliminar. Dois pontos do pacote
 * quebravam isso assim que o `mesas` virou SSR de verdade (achados do Codex, P2,
 * PR #319); como `packages/ui` é compartilhado, a correção vale para os 6 apps.
 *
 * Sem matchers de `jest-dom`: o `vitest.config.ts` deste pacote registra que
 * eles não entram aqui de propósito.
 *
 * O `localStorage` é instalado à mão porque o `window.localStorage` do jsdom 29
 * deste pacote é um objeto liso, sem `setItem`/`getItem`/`clear` — medido com
 * sonda: `proto: Object`, `setItem: undefined`. `Storage` existe como função
 * global, mas não está ligado a essa instância, então espiar
 * `Storage.prototype` também não a alcança.
 */

type Guardado = Record<string, string>;

function instalarLocalStorage(inicial: Guardado = {}, aoLer?: () => void) {
  const dados: Guardado = { ...inicial };
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: {
      getItem(chave: string) {
        aoLer?.();
        return chave in dados ? dados[chave] : null;
      },
      setItem(chave: string, valor: string) {
        dados[chave] = valor;
      },
      removeItem(chave: string) {
        delete dados[chave];
      },
      clear() {
        for (const chave of Object.keys(dados)) delete dados[chave];
      },
    },
  });
}

function BadgeSonda({ chave, marcador }: { chave: string; marcador: string }) {
  const { hasNewUpdate } = useChangelogBadge(chave, marcador);
  return <span data-testid="badge">{hasNewUpdate ? "novo" : "vazio"}</span>;
}

describe("useChangelogBadge — servidor e primeiro render do cliente concordam", () => {
  beforeEach(() => {
    instalarLocalStorage();
  });

  // `cleanup` explícito: este pacote não tem `setupFiles` (decisão registrada em
  // `vitest.config.ts`), e sem ele o auto-cleanup do testing-library não é
  // registrado — o DOM acumula entre os casos e `getByTestId` acha vários.
  afterEach(() => {
    cleanup();
  });

  it("servidor e cliente começam iguais mesmo sem marcador salvo", () => {
    // Este é o caso da PRIMEIRA VISITA e o de toda versão nova: o storage não
    // tem o marcador atual. Antes, o servidor dizia "vazio" e o cliente dizia
    // "novo" já no primeiro render, acrescentando um <span> que o HTML do
    // servidor não tinha.
    const noServidor = renderToString(<BadgeSonda chave="k" marcador="v2" />);

    expect(noServidor).toContain("vazio");
    expect(noServidor).not.toContain("novo");
  });

  it("o badge aparece depois da hidratação, não durante", async () => {
    instalarLocalStorage({ k: "v1" }); // marcador antigo: há novidade

    render(<BadgeSonda chave="k" marcador="v2" />);

    // O efeito roda após o primeiro commit e então o badge acende.
    await waitFor(() => expect(screen.getByTestId("badge").textContent).toBe("novo"));
  });

  it("sem novidade, o badge permanece apagado", async () => {
    instalarLocalStorage({ k: "v2" }); // já viu a versão atual

    render(<BadgeSonda chave="k" marcador="v2" />);

    await waitFor(() => expect(screen.getByTestId("badge").textContent).toBe("vazio"));
  });

  it("localStorage bloqueado não derruba o componente", async () => {
    // Navegador com cookies de terceiros bloqueados lança ao LER o storage.
    instalarLocalStorage({}, () => {
      throw new DOMException("bloqueado");
    });

    render(<BadgeSonda chave="k" marcador="v2" />);

    await waitFor(() => expect(screen.getByTestId("badge").textContent).toBe("vazio"));
  });
});

describe("useTheme — snapshot do servidor casa com o script inline", () => {
  afterEach(() => {
    cleanup();
    delete document.documentElement.dataset.theme;
  });

  it("o servidor assume dark, o mesmo default do script inline sem cookie", () => {
    // O script inline do `root.tsx` escreve `data-theme="dark"` quando não há
    // cookie, ANTES da primeira pintura. Um snapshot `light` aqui fazia o
    // chrome sair claro sobre a página escura até a hidratação.
    // O ícone do sol (o que se mostra no tema escuro) tem <circle>; o da lua não.
    const noServidor = renderToString(<ThemeToggle />);

    expect(noServidor).toContain("circle");
  });

  it("no cliente, o tema vem do data-theme que o script inline já aplicou", () => {
    document.documentElement.dataset.theme = "light";

    const { container } = render(<ThemeToggle />);

    // Tema claro mostra a lua (path único, sem <circle>).
    expect(container.querySelector("circle")).toBeNull();
  });
});
