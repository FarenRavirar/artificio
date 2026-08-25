import { useMemo } from 'react';
import { Button } from '@artificio/ui';
import { Eye } from 'lucide-react';
import { TableCardComponent } from '../../../components/TableCard';
import { editorStateToCardPreview } from './cardPreviewMapping';
import type { TableEditorState } from '../types';

/**
 * Prévia ao vivo do card + "Ver como jogador" (spec 096 R22/A25, T4.2b).
 *
 * A prévia usa o `TableCardComponent` REAL (montagem do objeto TableCard em
 * cardPreviewMapping.ts, com os mesmos mappers do payload). "Ver como
 * jogador" só existe com página pública (slug + status active) — rascunho
 * fica desabilitado com o porquê no tooltip.
 *
 * O card é montado em `inert`: é um ESPELHO, não navegação — clicar não pode
 * tirar o mestre do editor sem querer; o caminho sancionado para a página
 * pública é o botão, em nova aba (o estado do editor fica intacto). Nova aba
 * funciona porque o nginx serve o SPA com fallback para /mesas/:slug
 * (nginx.conf "Fallback SPA").
 */
interface CardPreviewProps {
  state: TableEditorState;
  systemName?: string | null;
  systemLogoFilename?: string | null;
  systemWebsiteUrl?: string | null;
}

export function CardPreview({
  state,
  systemName,
  systemLogoFilename,
  systemWebsiteUrl,
}: CardPreviewProps) {
  const preview = useMemo(
    () =>
      editorStateToCardPreview(state, {
        systemName,
        systemLogoFilename,
        systemWebsiteUrl,
      }),
    [state, systemName, systemLogoFilename, systemWebsiteUrl],
  );

  const hasPublicPage =
    typeof state.slug === 'string' && state.slug.length > 0 && state.status === 'active';

  return (
    <section
      className="table-editor-preview flex gap-2 border-t border-[var(--line)] pt-2.5"
      aria-label="Prévia do anúncio"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-[0.04em] opacity-75">
          Prévia do anúncio
        </h2>
        {hasPublicPage ? (
          <Button
            href={`/mesas/${state.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            variant="secondary"
            size="sm"
            leftIcon={<Eye className="h-4 w-4" aria-hidden="true" />}
          >
            Ver como jogador
          </Button>
        ) : (
          <span title="Disponível depois que a mesa estiver publicada">
            <Button
              variant="secondary"
              size="sm"
              disabled
              leftIcon={<Eye className="h-4 w-4" aria-hidden="true" />}
            >
              Ver como jogador
            </Button>
          </span>
        )}
      </div>
      <div className="table-editor-preview-card" inert>
        <TableCardComponent table={preview} />
      </div>
    </section>
  );
}
