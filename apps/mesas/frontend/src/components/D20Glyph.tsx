interface D20GlyphProps {
  className?: string;
}

/**
 * Icosaedro (d20) em line-art — assinatura visual do catálogo de mesas.
 * Um dado, não uma lupa genérica: é o objeto que qualquer mesa de RPG compartilha.
 */
export function D20Glyph({ className }: D20GlyphProps) {
  return (
    <svg
      viewBox="0 0 100 100"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M50 4 L88 27 L88 73 L50 96 L12 73 L12 27 Z" />
      <path d="M50 4 L50 35 M88 27 L50 35 M12 27 L50 35 M88 73 L50 35 M12 73 L50 35 M50 96 L50 35" />
      <path d="M50 4 L12 27 M50 4 L88 27 M12 73 L12 27 M88 73 L88 27 M50 96 L12 73 M50 96 L88 73" opacity="0.5" />
    </svg>
  );
}
