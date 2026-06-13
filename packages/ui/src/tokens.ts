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
    warningText: "#A16207", // amber 700 — texto AA sobre claro
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
  font: {
    display: '"Oswald", "Arial Narrow", system-ui, sans-serif', // headings condensados
    sans: '"Inter", ui-sans-serif, system-ui, sans-serif', // corpo
  },
  radius: {
    sm: "4px",
    md: "8px",
  },
} as const;
