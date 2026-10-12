import { beforeEach, describe, expect, it } from "vitest";
import {
  gtagSrc,
  gtagInlineConfig,
  initGtag,
  ANALYTICS_DEFAULTS,
  trackSearch,
  trackViewTermo,
  trackSelectMesa,
  trackContactClick,
  trackFilterSistema,
  trackPageview,
} from "./index.js";

describe("gtag", () => {
  it("gtagSrc inclui o id", () => {
    expect(gtagSrc("G-ABC123")).toBe("https://www.googletagmanager.com/gtag/js?id=G-ABC123");
  });
  it("config usa cookie_domain raiz (cross-subdomínio)", () => {
    const js = gtagInlineConfig("G-ABC123");
    expect(js).toContain('"cookie_domain":".artificiorpg.com"');
    expect(js).toContain("gtag('config', \"G-ABC123\"");
    expect(ANALYTICS_DEFAULTS.cookieDomain).toBe(".artificiorpg.com");
  });
  it("respeita opts (anonymizeIp/debug)", () => {
    const js = gtagInlineConfig("G-X", { anonymizeIp: true, debug: true, cookieDomain: ".x.com" });
    expect(js).toContain('"anonymize_ip":true');
    expect(js).toContain('"debug_mode":true');
    expect(js).toContain('"cookie_domain":".x.com"');
  });
  it("desliga sinais de anúncio (sem doubleclick/ga-audiences)", () => {
    const js = gtagInlineConfig("G-X");
    expect(js).toContain('"allow_google_signals":false');
    expect(js).toContain('"allow_ad_personalization_signals":false');
  });
});

describe("initGtag", () => {
  const GA_ID = "G-ABC123";

  beforeEach(() => {
    document.querySelectorAll('script[src*="googletagmanager.com/gtag/js"]').forEach((s) => s.remove());
    document.querySelectorAll("script[data-artificio-gtag]").forEach((s) => s.remove());
    window.dataLayer = [];
    (window as unknown as Record<string, unknown>).gtag = undefined;
  });

  /**
   * O vitest copia o `window` do jsdom para o global do Node, e o `<script>` inline
   * que o `initGtag` injeta rodaria no `window` interno do jsdom, não neste. Para o
   * teste ver o mesmo `dataLayer` que o navegador vê, o texto do snippet roda aqui,
   * no escopo global (eval indireto, como o navegador faz com script clássico).
   */
  function initGtagExecutado(id: string, opts?: Parameters<typeof initGtag>[1]) {
    initGtag(id, opts);
    document.querySelectorAll<HTMLScriptElement>(`script[data-artificio-gtag="${id}"]`).forEach((s) => {
      (0, eval)(s.text);
    });
  }

  /** Comando do dataLayer como array, qualquer que seja o tipo do item. */
  const comandos = () =>
    (window.dataLayer as unknown[]).map((entry) => Array.from(entry as ArrayLike<unknown>));

  it("empurra objetos `arguments`, não Array — o gtag.js ignora Array (spec 105 T1.0)", () => {
    initGtagExecutado(GA_ID);
    const dl = window.dataLayer as unknown[];
    expect(dl.length).toBeGreaterThan(0);
    for (const entry of dl) {
      expect(Array.isArray(entry)).toBe(false);
      expect(Object.prototype.toString.call(entry)).toBe("[object Arguments]");
    }
  });

  it("define window.gtag que também empurra `arguments`", () => {
    initGtagExecutado(GA_ID);
    window.gtag!("event", "teste");
    const ultimo = (window.dataLayer as unknown[]).at(-1);
    expect(Object.prototype.toString.call(ultimo)).toBe("[object Arguments]");
  });

  it("injeta o script do gtag com o src correto", () => {
    initGtagExecutado(GA_ID);
    const script = document.querySelector(
      `script[src="https://www.googletagmanager.com/gtag/js?id=${GA_ID}"]`,
    );
    expect(script).not.toBeNull();
    expect((script as HTMLScriptElement).async).toBe(true);
  });

  it("é idempotente: 2 chamadas = 1 só <script>", () => {
    initGtagExecutado(GA_ID);
    const count = document.querySelectorAll(
      `script[src*="googletagmanager.com/gtag/js"]`,
    ).length;
    initGtagExecutado(GA_ID);
    initGtagExecutado(GA_ID);
    const countAfter = document.querySelectorAll(
      `script[src*="googletagmanager.com/gtag/js"]`,
    ).length;
    expect(countAfter).toBe(count);
  });

  it("configura com send_page_view:false", () => {
    initGtagExecutado(GA_ID);
    const configCall = comandos().find((entry) => entry[0] === "config") as unknown[];
    expect(configCall).toBeDefined();
    const cfg = configCall[2] as Record<string, unknown>;
    expect(cfg.send_page_view).toBe(false);
    expect(cfg.allow_google_signals).toBe(false);
    expect(cfg.allow_ad_personalization_signals).toBe(false);
  });

  it("anonymize_ip:true por padrão", () => {
    initGtagExecutado("G-XYZ");
    const configCall = comandos().find((entry) => entry[0] === "config") as unknown[];
    const cfg = configCall[2] as Record<string, unknown>;
    expect(cfg.anonymize_ip).toBe(true);
  });

  it("anonymize_ip pode ser desligado via opts", () => {
    window.dataLayer = [];
    (window as unknown as Record<string, unknown>).gtag = undefined;
    initGtagExecutado("G-OFF", { anonymizeIp: false });
    const configCall = comandos().find((entry) => entry[0] === "config") as unknown[];
    const cfg = configCall[2] as Record<string, unknown>;
    expect(cfg.anonymize_ip).toBeUndefined();
  });

  it("usa cookie_domain raiz dos ANALYTICS_DEFAULTS", () => {
    window.dataLayer = [];
    (window as unknown as Record<string, unknown>).gtag = undefined;
    initGtagExecutado("G-DOM");
    const configCall = comandos().find((entry) => entry[0] === "config") as unknown[];
    const cfg = configCall[2] as Record<string, unknown>;
    expect(cfg.cookie_domain).toBe(".artificiorpg.com");
  });
});

describe("events catalog", () => {
  it("trackSearch só envia com >=2 caracteres", () => {
    const calls: unknown[] = [];
    window.gtag = (...args: unknown[]) => calls.push(args);

    trackSearch("a");
    expect(calls.length).toBe(0);

    trackSearch("ab");
    expect(calls.length).toBe(1);
    const [call] = calls as [string, string, Record<string, unknown>][];
    expect(call[0]).toBe("event");
    expect(call[1]).toBe("search");
    expect(call[2]).toEqual({ search_term: "ab" });
  });

  it("trackViewTermo envia event com params", () => {
    const calls: unknown[] = [];
    window.gtag = (...args: unknown[]) => calls.push(args);

    trackViewTermo({ termo_id: "42", termo: "Fireball", sistema: "D&D 2024" });
    expect(calls.length).toBe(1);
    const [call] = calls as [string, string, Record<string, unknown>][];
    expect(call[0]).toBe("event");
    expect(call[1]).toBe("view_termo");
    expect(call[2]).toEqual({ termo_id: "42", termo: "Fireball", sistema: "D&D 2024" });
  });

  it("trackSelectMesa envia event com params", () => {
    const calls: unknown[] = [];
    window.gtag = (...args: unknown[]) => calls.push(args);

    trackSelectMesa({ mesa_id: "7", mesa_nome: "Mesa do Dragão" });
    expect(calls.length).toBe(1);
    const [call] = calls as [string, string, Record<string, unknown>][];
    expect(call[0]).toBe("event");
    expect(call[1]).toBe("select_mesa");
    expect(call[2]).toEqual({ mesa_id: "7", mesa_nome: "Mesa do Dragão" });
  });

  it("trackFilterSistema envia event com params", () => {
    const calls: unknown[] = [];
    window.gtag = (...args: unknown[]) => calls.push(args);

    trackFilterSistema({ sistema: "D&D 2014" });
    expect(calls.length).toBe(1);
    const [call] = calls as [string, string, Record<string, unknown>][];
    expect(call[0]).toBe("event");
    expect(call[1]).toBe("filter_sistema");
    expect(call[2]).toEqual({ sistema: "D&D 2014" });
  });

  it("trackSearch redige e-mail do search_term", () => {
    const calls: unknown[] = [];
    window.gtag = (...args: unknown[]) => calls.push(args);

    trackSearch("contato a@b.com");
    expect(calls.length).toBe(1);
    const [call] = calls as [string, string, Record<string, unknown>][];
    expect(call[0]).toBe("event");
    expect(call[1]).toBe("search");
    expect(call[2]).toEqual({ search_term: "contato [redacted]" });
  });

  it("event params excluem undefined", () => {
    const calls: unknown[] = [];
    window.gtag = (...args: unknown[]) => calls.push(args);

    trackViewTermo({ termo_id: "1", termo: "Test" });
    const [call] = calls as [string, string, Record<string, unknown>][];
    expect(call[2]).not.toHaveProperty("sistema");
  });

  it("trackPageview envia page_location/page_title sem query (spec 105 I1)", () => {
    const calls: unknown[] = [];
    window.gtag = (...args: unknown[]) => calls.push(args);
    document.title = "Mesa X";

    trackPageview("/x?email=a@b.com#frag");
    const esperado = { page_location: `${window.location.origin}/x`, page_title: "Mesa X" };
    expect(calls).toEqual([
      ["set", esperado],
      ["event", "page_view", esperado],
    ]);
    // `page_path` é parâmetro da geração UA, ausente da doc do GA4.
    expect(JSON.stringify(calls)).not.toContain("page_path");
  });

  it("trackContactClick envia contact_click só com canal e ids públicos", () => {
    const calls: unknown[] = [];
    window.gtag = (...args: unknown[]) => calls.push(args);

    trackContactClick({ origem: "mesa", canal: "whatsapp", mesa_id: "7", sistema: "D&D 5e" });
    expect(calls).toEqual([
      ["event", "contact_click", { origem: "mesa", canal: "whatsapp", mesa_id: "7", sistema: "D&D 5e" }],
    ]);
  });
});

describe("ssr guard", () => {
  it("initGtag nao lanca com window/document indefinidos", () => {
    expect(() => {
      initGtag("G-ABC123");
    }).not.toThrow();
  });
});

// TODO: teste do hook useAnalyticsPageviews (evitar dep nova @testing-library/react)
