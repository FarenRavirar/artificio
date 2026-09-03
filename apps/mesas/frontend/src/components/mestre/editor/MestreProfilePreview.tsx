import type { MestrePublicData } from '../../../hooks/useMestre';
import { MestreHero } from '../MestreHero';

/**
 * Prévia do perfil público do mestre nas telas de edição (spec 099, B10/D5/D8).
 *
 * A prévia consome o `MestreHero` REAL — o mesmo componente da página pública —
 * com os dados ATUAIS do editor: nada de valor fake nem réplica do hero. O
 * scrim fixo do banner (D8) vem de graça do componente: a prévia mostra o véu
 * exatamente como o jogador vê, e NÃO existe controle de opacidade aqui.
 *
 * O container segue o padrão do `CardPreview` do editor de mesa
 * (features/table-editor/components/CardPreview.tsx): rótulo pequeno em
 * caixa alta + conteúdo em `inert`. `inert` é ESPELHO, não navegação — os CTAs
 * do hero (rolagem para contato/mesas) não podem prender o mestre fora do
 * editor; o caminho sancionado para a página pública é o /mestre/:slug.
 *
 * O mapeamento editor → `MestrePublicData` vive em `profilePreviewMapping.ts`
 * (react-refresh/only-export-components — arquivo de componente não exporta
 * função/constante, mesmo padrão do cardPreviewMapping do editor de mesa).
 */
export function MestreProfilePreview({ profile }: Readonly<{ profile: MestrePublicData }>) {
  return (
    <section
      className="mestre-profile-preview flex flex-col gap-2"
      aria-label="Prévia do perfil"
    >
      <h3 className="text-[length:var(--text-label)] leading-[var(--leading-label)] font-[var(--weight-strong)] uppercase tracking-[0.04em] opacity-75">
        Prévia do perfil
      </h3>
      <div className="mestre-profile-preview-hero" inert>
        <MestreHero profile={profile} mappedTables={[]} totalOpenSlots={0} />
      </div>
    </section>
  );
}
