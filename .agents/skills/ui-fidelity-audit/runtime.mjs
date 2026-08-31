#!/usr/bin/env node
// Medicao EM VIEWPORT — o que analise estatica nao alcanca.
//
// Por que este arquivo existe: `audit.mjs` le CSS/TSX e pega divergencia de token,
// regua e reimplementacao. Nao pega o que so existe DEPOIS de renderizar — alvo com
// altura real abaixo do piso, texto estourando a caixa, contraste efetivo, overflow
// horizontal. Leitor de DOM+CSS (jsdom) NAO resolve: medido nesta base, devolve
// getBoundingClientRect 0x0 e scrollWidth 0, porque nao tem motor de layout. Quem
// calcula layout e o Chromium.
//
// Este script NAO abre navegador sozinho: ele emite o plano de medicao (as rotas, as
// larguras e o JS a executar) para o agente rodar via Playwright MCP, e depois avalia
// o JSON coletado. Assim a skill nao acrescenta dependencia pesada ao repo (etapa 1).
//
// Uso:
//   node runtime.mjs --plan                      # imprime o plano (rotas + script)
//   node runtime.mjs --check <coleta.json>       # avalia o resultado coletado
import { readFileSync } from "node:fs";

const BASE = process.env.UI_FIDELITY_BASE || "https://mesasbeta.artificiorpg.com";

// 1366x768 e 1920x1080 sao as larguras que a spec 099 (A3) exige para a dobra.
// 719px e a largura em que o editor tem media query (spec 099 §7): abaixo de 768.
const VIEWPORTS = [
  { nome: "desktop-1366", width: 1366, height: 768 },
  { nome: "desktop-1920", width: 1920, height: 1080 },
  { nome: "mobile-719", width: 719, height: 900 },
];

// Rotas publicas — sem sessao. O editor exige login e fica fora desta etapa.
const ROTAS = [
  { nome: "catalogo", path: "/" },
  { nome: "perfil-mestre", path: "/mestre/farenravirar" },
];

// Executado DENTRO da pagina pelo Playwright MCP (browser_evaluate).
// Tudo aqui depende de layout real: e exatamente o que o jsdom nao entrega.
const SCRIPT_COLETA = `() => {
  const PISO_ALVO = 24; // WCAG 2.2 SC 2.5.8 nivel AA, em CSS px

  const visivel = (el) => {
    const s = getComputedStyle(el);
    if (s.display === "none" || s.visibility === "hidden" || s.opacity === "0") return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };

  const seletor = (el) => {
    const id = el.id ? "#" + el.id : "";
    const cls = (el.className && typeof el.className === "string")
      ? "." + el.className.trim().split(/\\s+/).slice(0, 2).join(".")
      : "";
    return el.tagName.toLowerCase() + id + cls;
  };

  // [R1] Alvo clicavel abaixo do piso — altura REAL, nao a declarada.
  const alvos = [];
  for (const el of document.querySelectorAll('a, button, input, select, textarea, [role="button"], [role="link"], [onclick]')) {
    if (!visivel(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.height < PISO_ALVO || r.width < PISO_ALVO) {
      alvos.push({
        sel: seletor(el),
        w: Math.round(r.width * 10) / 10,
        h: Math.round(r.height * 10) / 10,
        texto: (el.textContent || "").trim().slice(0, 40),
      });
    }
  }

  // [R2] Texto estourando a caixa — a quebra depende da fonte carregada e do
  // conteudo real, por isso nenhuma leitura de CSS consegue prever.
  const estouros = [];
  for (const el of document.querySelectorAll("*")) {
    if (!visivel(el)) continue;
    if (el.children.length > 0) continue;          // so folha, para nao contar o pai
    const s = getComputedStyle(el);
    // Rolagem propria (auto/scroll) e intencional e sai. 'hidden' NAO sai: e
    // exatamente onde o texto e cortado sem aviso, e 'text-overflow: ellipsis'
    // EXIGE overflow != visible — com o filtro antigo a deteccao de truncamento
    // era inalcancavel. Medido em mesasbeta: 61 elementos descartados, 40 deles
    // com ellipsis.
    const ox = s.overflowX;
    const rolavel = ox === "auto" || ox === "scroll";
    if (rolavel) continue;
    // Texto so para leitor de tela (.sr-only) e recortado a 1px DE PROPOSITO —
    // acusa-lo como truncamento e falso positivo (medido: label.sr-only com
    // scrollW 84 e clientW 1).
    if (el.clientWidth <= 1 || el.clientHeight <= 1) continue;
    const estouraX = el.scrollWidth - el.clientWidth > 1;
    const cortado = s.textOverflow === "ellipsis" && el.scrollWidth > el.clientWidth + 1;
    if (estouraX || cortado) {
      estouros.push({
        sel: seletor(el),
        scrollW: el.scrollWidth,
        clientW: el.clientWidth,
        cortado,
        texto: (el.textContent || "").trim().slice(0, 40),
      });
    }
  }

  // [R3] Overflow horizontal da pagina — barra lateral em mobile e defeito classico
  // que so aparece na largura real.
  const overflowPagina = {
    scrollW: document.documentElement.scrollWidth,
    clientW: document.documentElement.clientWidth,
    estoura: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  };

  // [R4] Contraste efetivo: a cor de fundo real e a do primeiro ancestral opaco,
  // que so se descobre subindo a arvore renderizada.
  const lum = (rgb) => {
    const c = rgb.map((v) => {
      const x = v / 255;
      return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  };
  const parse = (s) => {
    const m = s.match(/rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)(?:,\\s*([\\d.]+))?\\)/);
    return m ? { rgb: [+m[1], +m[2], +m[3]], a: m[4] === undefined ? 1 : +m[4] } : null;
  };
  const fundoReal = (el) => {
    let n = el;
    while (n && n !== document.documentElement) {
      const p = parse(getComputedStyle(n).backgroundColor);
      if (p && p.a > 0.9) return p.rgb;
      n = n.parentElement;
    }
    const b = parse(getComputedStyle(document.body).backgroundColor);
    return b ? b.rgb : [255, 255, 255];
  };
  const contrastes = [];
  for (const el of document.querySelectorAll("p, span, a, li, h1, h2, h3, h4, label, button, td, th")) {
    if (!visivel(el) || !(el.textContent || "").trim()) continue;
    if (el.children.length > 0) continue;
    const s = getComputedStyle(el);
    const fg = parse(s.color);
    if (!fg) continue;
    const bg = fundoReal(el);
    // Cor de texto com alfa ('text-white/70' e afins) precisa ser COMPOSTA sobre o
    // fundo antes do contraste — usar fg.rgb cru infla o resultado e silencia o
    // defeito. Medido: branco a 40% sobre #0f172a da 3.81:1 (reprova), e o calculo
    // sem compor dizia 17.85:1 (passa). Em mesasbeta, 19 textos tem alfa na cor.
    const fgComposto = fg.a >= 1
      ? fg.rgb
      : fg.rgb.map((v, i) => Math.round(v * fg.a + bg[i] * (1 - fg.a)));
    const l1 = lum(fgComposto), l2 = lum(bg);
    const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    const px = parseFloat(s.fontSize);
    const bold = parseInt(s.fontWeight, 10) >= 700;
    const grande = px >= 24 || (px >= 18.66 && bold);
    const piso = grande ? 3 : 4.5; // WCAG 2.1 SC 1.4.3 AA
    if (ratio < piso) {
      contrastes.push({
        sel: seletor(el),
        ratio: Math.round(ratio * 100) / 100,
        piso,
        fontePx: px,
        texto: (el.textContent || "").trim().slice(0, 40),
      });
    }
  }

  return {
    url: location.href,
    viewport: { w: innerWidth, h: innerHeight },
    alturaPagina: document.documentElement.scrollHeight,
    telas: Math.round((document.documentElement.scrollHeight / innerHeight) * 100) / 100,
    alvos, estouros, overflowPagina, contrastes,
  };
}`;

const argv = process.argv.slice(2);

if (argv.includes("--plan")) {
  console.log("# Plano de medicao em viewport — rodar via Playwright MCP\n");
  console.log(`Base: ${BASE}\n`);
  console.log("Para CADA combinacao rota x viewport abaixo:");
  console.log("  1. browser_resize(width, height)");
  console.log("  2. browser_navigate(url)");
  console.log("  3. browser_evaluate(function: <SCRIPT_COLETA>)");
  console.log("  4. guardar o JSON devolvido num array\n");
  console.log("Combinacoes:");
  for (const r of ROTAS) {
    for (const v of VIEWPORTS) {
      console.log(`  - ${r.nome} @ ${v.nome}: ${BASE}${r.path} (${v.width}x${v.height})`);
    }
  }
  console.log("\nDepois: node runtime.mjs --check coleta.json");
  console.log("\n--- SCRIPT_COLETA (passar como `function` ao browser_evaluate) ---");
  console.log(SCRIPT_COLETA);
  process.exit(0);
}

if (argv.includes("--check")) {
  const arq = argv[argv.indexOf("--check") + 1];
  if (!arq) { console.error("uso: node runtime.mjs --check <coleta.json>"); process.exit(2); }
  const dados = JSON.parse(readFileSync(arq, "utf8"));
  const coletas = Array.isArray(dados) ? dados : [dados];

  let fail = 0;

  // Coleta vazia ou incompleta NAO pode sair verde: com `[]` o script dizia
  // "Tudo verde em runtime" e exit 0, permitindo declarar A3/mobile medidos sem
  // nenhuma amostra. Auditoria que aprova o que nao mediu e o defeito que esta
  // skill existe para combater.
  if (coletas.length === 0) {
    console.error("FAIL coleta vazia — nenhuma amostra para avaliar");
    process.exit(1);
  }

  const esperadas = ROTAS.flatMap((r) => VIEWPORTS.map((v) => ({
    chave: `${r.path} @ ${v.width}`, path: r.path, width: v.width,
  })));
  const presentes = coletas.map((c) => {
    let path = "?";
    try { path = new URL(c.url).pathname; } catch { /* url ausente ou invalida */ }
    return `${path} @ ${c.viewport?.w}`;
  });
  const faltando = esperadas.filter((e) => !presentes.includes(e.chave));
  if (faltando.length) {
    console.error(`FAIL coleta incompleta — ${faltando.length} de ${esperadas.length} combinacoes ausentes:`);
    for (const f of faltando) console.error(`  - ${f.path} @ ${f.width}px`);
    console.error("Rode as combinacoes que faltam (node runtime.mjs --plan) antes de concluir.");
    process.exit(1);
  }
  const linha = (ok, txt) => { if (!ok) fail++; console.log(`${ok ? "OK  " : "FAIL"} ${txt}`); };

  for (const c of coletas) {
    console.log(`\n== ${c.url} @ ${c.viewport.w}x${c.viewport.h} (${c.telas} telas)`);
    linha(c.alvos.length === 0,
      `[R1] alvos < 24px: ${c.alvos.length}` +
      (c.alvos.length ? " — " + c.alvos.slice(0, 5).map((a) => `${a.sel} ${a.w}x${a.h}`).join(", ") : ""));
    linha(c.estouros.length === 0,
      `[R2] texto estourando/cortado: ${c.estouros.length}` +
      (c.estouros.length ? " — " + c.estouros.slice(0, 5).map((e) => `${e.sel} (${e.scrollW}>${e.clientW})`).join(", ") : ""));
    linha(!c.overflowPagina.estoura,
      `[R3] overflow horizontal da pagina: ${c.overflowPagina.estoura ? `${c.overflowPagina.scrollW} > ${c.overflowPagina.clientW}` : "nao"}`);
    linha(c.contrastes.length === 0,
      `[R4] contraste abaixo do piso WCAG: ${c.contrastes.length}` +
      (c.contrastes.length ? " — " + c.contrastes.slice(0, 5).map((x) => `${x.sel} ${x.ratio}:1 (piso ${x.piso})`).join(", ") : ""));
  }

  console.log(fail ? `\n${fail} medicao(oes) reprovada(s).` : "\nTudo verde em runtime.");
  process.exit(fail ? 1 : 0);
}

console.error("uso: node runtime.mjs --plan | --check <coleta.json>");
process.exit(2);
