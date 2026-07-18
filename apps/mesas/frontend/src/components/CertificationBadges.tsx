interface CertificationBadgesProps {
  is_covil?: boolean;
  is_ddal?: boolean;
  className?: string;
}

/**
 * Componente compartilhado para renderizar badges de certificação de mesas.
 * Centraliza a lógica e estilos de badges Covil do Lich e DDAL.
 *
 * @param is_covil - Se a mesa é certificada pelo Covil do Lich
 * @param is_ddal - Se a mesa é certificada DDAL (D&D Adventurers League)
 * @param className - Classes CSS adicionais para o container
 */
export function CertificationBadges({ is_covil, is_ddal, className = '' }: CertificationBadgesProps) {
  // Se não há badges, não renderizar nada
  if (!is_covil && !is_ddal) {
    return null;
  }

  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {/* Achado Codex (PR #182): fundo bg-black/70 é overlay sempre-escuro
          (badge sobre banner/imagem), não remapeia com tema — usa hex
          arbitrário em vez de text-purple-100/text-amber-100 pra escapar do
          remap global de index.css (que trocaria a cor pra tom escuro em
          light, quebrando contraste contra o preto fixo). */}
      {is_covil && (
        <span className="px-2 py-1 rounded-md text-[11px] font-black tracking-wide text-[#f3e8ff] bg-black/70 backdrop-blur-sm border border-purple-500/40">
          👑 Covil do Lich
        </span>
      )}
      {is_ddal && (
        <span className="px-2 py-1 rounded-md text-[11px] font-black tracking-wide text-[#fef3c7] bg-black/70 backdrop-blur-sm border border-amber-500/30">
          🛡️ DDAL
        </span>
      )}
    </div>
  );
}
