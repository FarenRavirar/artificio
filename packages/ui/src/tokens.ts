// Design tokens Artifício RPG — paleta REAL da marca (D064 supera D040 no laranja).
// Laranja de marca = acento vermelho-laranja da UI (midias/telaprincipal.png), NÃO o
// pêssego do hexágono do logo que o D040 amostrou. Navy de contraste = D040. Hex:
//   brand   #FF5722  → acento de marca/UI (Material Deep Orange 500), D064
//   ink     #020740  → cropped-logo-header-site-azul.png (navy da marca; texto/contraste)
//   navy    #1B2A4A  → superfície escura do app (header/footer dark); NÃO é cor de marca
//   bronze  #9C6B43  → Banner-Geral.jpg (tagline "SEU CONTEÚDO EM PORTUGUÊS")
//   char.   #0F1014  → Banner-Geral.jpg (fundo escuro)
// Regra de contraste (D038, Nielsen/ISO 9241-11): laranja = acento/marca/borda/foco,
// NUNCA texto de corpo sobre branco (falha AA). Texto = ink/muted.
export const tokens = {
  color: {
    ink: "#020740", // navy da marca — texto principal sobre claro / wordmark
    muted: "#5A6172", // texto secundário (AA em branco ~4.9:1)
    line: "#E3E5EC",
    surface: "#FFFFFF",
    canvas: "#F6F7FA",
    charcoal: "#0F1014", // superfície escura alternativa
    navy: "#1B2A4A", // superfície escura (header/footer dark = navy do hero do app)
    brand: "#FF5722", // laranja-assinatura — acento/marca (D064, Deep Orange 500)
    brandDeep: "#E64A19", // laranja escuro — hover/pressed/foco (Deep Orange 700)
    bronze: "#9C6B43", // secundário decorativo
    focus: "#E64A19",

    // Semânticos (B11/Spec 020) — estado/feedback. Acento ANCORA nos valores do
    // mesas (`--success/--warn/--danger/--info`); `*Text` = variante escurecida
    // p/ TEXTO/ÍCONE com AA sobre claro (lição do bug B7: o tom brilhante passa
    // AA no escuro mas falha no claro). Variante light/dark deriva do token, não do app.
    success: "#10B981", // emerald 600 (mesas --success-strong) — fill/borda/acento
    successText: "#15803D", // green 700 — texto/ícone AA sobre claro
    warning: "#F59E0B", // amber 500 (mesas --warn-strong)
    // amber 800 — texto AA sobre o fundo real do badge/banner de warning.
    // Era #A16207 (amber 700), que media 4.42:1 sobre rgb(254,241,221) — o que
    // `--state-warning-bg` compõe no light — e reprovava o mínimo 4.5 de AA
    // apesar do comentário que já prometia "AA sobre claro" (achado do
    // mantenedor, 2026-08-26). #854D0E mede 6.16:1 no mesmo fundo.
    warningText: "#854D0E",
    danger: "#EF4444", // red 500 (mesas --danger)
    dangerText: "#B91C1C", // red 700 — texto AA sobre claro
    info: "#38BDF8", // sky 400 (mesas --info)
    infoText: "#1D4ED8", // blue 700 — texto AA sobre claro

    // Superfícies dark estruturadas (B10b) — ancoradas no piloto glossário (D065);
    // `darkSurface` = `navy` (#1B2A4A), âncora já tokenizada.
    darkCanvas: "#0F1830", // fundo de página escuro
    darkSubtle: "#16223E", // superfície sutil
    darkSurface: "#1B2A4A", // card/painel (= navy)
    darkStrong: "#22325A", // superfície forte/realce
    darkText: "#EEF1F8", // texto principal sobre dark
    darkMuted: "#AAB3C7", // texto secundário sobre dark

    // Superfícies light estruturadas (B10b) — ancoradas no piloto mesas (D066).
    lightCanvas: "#F4F6FB", // fundo de página claro
    lightSubtle: "#EEF2F8", // superfície sutil
    lightSurface: "#FFFFFF", // card/painel
    lightStrong: "#E6EBF4", // superfície forte/realce
    lightInk: "#0B1220", // texto principal sobre light
  },
  // Espelha `--artificio-font-*` de styles.css, que é a pilha canônica (spec 100
  // T1.2). Havia QUATRO declarações divergentes de corpo no repo, cada uma com
  // fallback próprio; como nenhum app carrega Inter de fato (medido: zero
  // `@font-face`/`<link>`), o fallback era o que renderizava — e renderizava
  // diferente em cada tela. `check-token-parity.mjs` reprova nova divergência.
  font: {
    display: '"Oswald", "Arial Narrow", "Roboto Condensed", ui-sans-serif, system-ui, sans-serif', // headings condensados
    sans: '"Inter", "Segoe UI", Roboto, ui-sans-serif, system-ui, sans-serif', // corpo
  },
  // Régua tipográfica (Camada 2): 6 papéis, 5 tamanhos, 3 pesos. Os utilitários
  // que a aplicam vivem em styles.css como `.artificio-text-*`.
  text: {
    display: "28px",
    title: "20px",
    section: "16px",
    body: "16px",
    support: "14px",
    label: "13px",
  },
  weight: {
    regular: 400,
    medium: 500,
    strong: 600,
  },
  // Espelha os --radius-* de styles.css, que é quem renderiza. Divergiam 2px no
  // `sm` (4px aqui, 0.375rem lá) porque check-token-parity.mjs só cobria hexes;
  // a spec 100 alinhou os dois valores e estendeu a trava a `radius`, para o
  // drift não voltar em silêncio. `pill` fica de fora: 999px é "o máximo", não
  // um degrau da escala.
  radius: {
    sm: "6px",
    md: "8px",
    lg: "12px",
  },
} as const;
