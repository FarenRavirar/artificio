// Design tokens Artifício RPG — paleta REAL da marca (D038).
// Hex amostrados por pixel dos assets em /midias:
//   brand   #FC9054  → Logo-PNG-Negativo-2.png (hexágono + "RPG")
//   ink     #10103A  → cropped-logo-header-site-azul.png (wordmark navy; puro #00003C, elevado p/ legibilidade)
//   bronze  #9C6B43  → Banner-Geral.jpg (tagline "SEU CONTEÚDO EM PORTUGUÊS")
//   char.   #0F1014  → Banner-Geral.jpg (fundo escuro)
// Regra de contraste (D038, Nielsen/ISO 9241-11): laranja = acento/marca/borda/foco,
// NUNCA texto de corpo sobre branco (falha AA). Texto = ink/muted.
export const tokens = {
  color: {
    ink: "#10103A", // navy — texto principal sobre claro / wordmark
    muted: "#5A6172", // texto secundário (AA em branco ~4.9:1)
    line: "#E3E5EC",
    surface: "#FFFFFF",
    canvas: "#F6F7FA",
    charcoal: "#0F1014", // superfície escura (header/hero dark)
    brand: "#FC9054", // laranja-assinatura — acento/marca
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
