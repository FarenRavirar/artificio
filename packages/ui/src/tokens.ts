// Design tokens Artifício RPG — paleta REAL da marca (D038).
// Padrão MÁXIMO de cor = midias/cropped-Logo-PNG-Negativo-2.png; azul de
// midias/cropped-logo-header-site-azul.png = contraste. Hex amostrados por pixel:
//   brand   #FF9457  → cropped-Logo-PNG-Negativo-2.png (hexágono/bússola + "RPG")
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
    brand: "#FF9457", // laranja-assinatura — acento/marca (padrão máximo)
    brandDeep: "#E0712F", // laranja escuro — hover/pressed/foco
    bronze: "#9C6B43", // secundário decorativo
    focus: "#E0712F",
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
