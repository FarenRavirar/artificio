import { cropToObjectPosition } from '@artificio/media/image-kinds';
import { Link } from 'react-router';
import { CheckCircle2, Star, Globe, MapPin } from 'lucide-react';
import type { TableCard } from '../../types/tables';
import { SlotsIndicator } from '../SlotsIndicator';
import { SystemBadge } from '../SystemBadge';
import { markdownToPlainText } from '@artificio/content-editor/sanitize';
import { CertificationBadges } from '../CertificationBadges';
import { getSlotsVisualState } from '../../utils/slots';
import { applyTableImageFallback, tableImageAttrs } from '../../utils/tableImage';

/**
 * A capa ocupa METADE do card, não a largura do container.
 *
 * Medido em `MestrePage.css`: `.mestre-featured-table-link` é
 * `grid-template-columns: 1fr 1fr` (linha 441), e só em `max-width: 768px` vira
 * `1fr` (linha 589). O `.container` do perfil lê `--page-max: 1200px`
 * (`MestrePage.css:22`, `:48-49`).
 *
 * A primeira versão declarava `(min-width: 1200px) 1200px, 100vw` — a largura
 * do CONTAINER, ignorando a divisão em duas colunas. Um navegador DPR 1 acredita
 * no `sizes` e escolheria a variante de 1200w para uma caixa de 600px,
 * transferindo cerca de quatro vezes mais pixels numa mudança feita para reduzir
 * payload (achado de review, PR #328). `sizes` de mentira é pior que não ter
 * `srcset`.
 *
 * `50vw` entre 769px e 1200px porque ali o container acompanha a janela; acima
 * de 1200px ele trava e a metade é fixa em 600px.
 */
const FEATURED_COVER_SIZES = '(min-width: 1200px) 600px, (min-width: 769px) 50vw, 100vw';

interface Props {
  table: TableCard;
}

const modalityLabels: Record<string, string> = {
  online: 'Online',
  presencial: 'Presencial',
  hibrida: 'Híbrida',
};

interface FeaturedTable extends TableCard {
  features?: unknown;
}

export function MestreFeaturedTable({ table }: Props) {
  const { isFull } = getSlotsVisualState(table);
  const rawFeatures = (table as FeaturedTable).features;
  const features = Array.isArray(rawFeatures)
    ? rawFeatures.filter((feature): feature is string => typeof feature === 'string')
    : [];

  return (
    <article className="mestre-featured-table">
      <Link
        to={`/mesas/${table.slug}`}
        className="mestre-featured-table-link"
        id={`featured-table-${table.slug}`}
      >
        <div className="mestre-featured-table-cover">
          {/* Mesma regra do card e do hero: sem `object-position` a capa é
              cortada pelo centro geométrico e o enquadramento escolhido pelo
              mestre é ignorado.

              SEM `priority`: a versão anterior marcava `priority: true` com a
              justificativa de ser "a primeira imagem da página". Medido em
              `MestrePage.tsx`, é falso — `MestreHero` renderiza na linha 111 com
              banner (`MestreHero.tsx:227`) e avatar (`:266`), e a seção de mesas
              só entra na linha 169, depois do grupo "Sobre" inteiro. Eager+high
              aqui fazia esta capa, normalmente abaixo da dobra, competir com as
              duas imagens realmente visíveis do hero (achado de review,
              PR #328). */}
          <img
            {...tableImageAttrs(table.cover_url, { sizes: FEATURED_COVER_SIZES })}
            alt={table.title}
            style={{
              objectPosition: cropToObjectPosition(
                table.cover_crop_data,
                table.cover_width,
                table.cover_height,
              ),
            }}
            onError={applyTableImageFallback}
          />

          {/* Badges de certificação */}
          <div className="absolute top-3 right-3 z-10 max-w-[70%]">
            <CertificationBadges
              is_covil={table.is_covil}
              is_ddal={table.is_ddal}
              className="justify-end"
            />
          </div>

          <span className="mestre-featured-table-badge">
            <Star className="w-4 h-4" /> Mesa em destaque
          </span>

          {/* Logo VTT */}
          {(table.modality === 'online' || table.modality === 'hibrida') && table.vtt_platform?.logo_filename && (
            table.vtt_platform.website_url ? (
              <a
                href={table.vtt_platform.website_url}
                target="_blank"
                rel="noopener noreferrer"
                className="absolute bottom-3 right-3 h-9 min-w-9 px-2 rounded-[var(--radius-md)] bg-black/55 border border-[var(--border-strong)] backdrop-blur-sm inline-flex items-center justify-center hover:bg-black/70 hover:border-[var(--border-strong)] transition-colors"
                title={`${table.vtt_platform.name} - Abrir site oficial`}
                onClick={(e) => e.stopPropagation()}
              >
                <img
                  src={`/vtt-logos/${table.vtt_platform.logo_filename}`}
                  alt={table.vtt_platform.name}
                  className="h-5 w-auto object-contain"
                  onError={(event) => {
                    event.currentTarget.parentElement?.classList.add('hidden');
                  }}
                />
              </a>
            ) : (
              <span
                className="absolute bottom-3 right-3 h-9 min-w-9 px-2 rounded-[var(--radius-md)] bg-black/55 border border-[var(--border-strong)] backdrop-blur-sm inline-flex items-center justify-center"
                title={table.vtt_platform.name}
              >
                <img
                  src={`/vtt-logos/${table.vtt_platform.logo_filename}`}
                  alt={table.vtt_platform.name}
                  className="h-5 w-auto object-contain"
                  onError={(event) => {
                    event.currentTarget.parentElement?.classList.add('hidden');
                  }}
                />
              </span>
            )
          )}
        </div>

        <div className="mestre-featured-table-content">
          <div className="mestre-featured-table-tags">
            {table.system_name && (
              <SystemBadge
                name={table.system_name}
                logoFilename={table.system_logo_filename}
                websiteUrl={table.system_website_url}
                className="!bg-transparent !border-[var(--border-strong)]"
              />
            )}
            <span className="mestre-featured-table-tag">
              {table.modality === 'online' ? <Globe className="w-3 h-3" /> : <MapPin className="w-3 h-3" />}
              {modalityLabels[table.modality] ?? table.modality}
            </span>
          </div>

          <h3 className="mestre-featured-table-title">{table.title}</h3>

          {/* O card inteiro é um <Link>, então a descrição não pode renderizar
              Markdown: um link no texto viraria <a> dentro de <a>, que é HTML
              inválido e quebra a hidratação. Como aqui é só um excerto, o
              Markdown é achatado em texto plano (review PR #227). */}
          {table.description && (
            <p className="mestre-featured-table-description">
              {markdownToPlainText(table.description, 240)}
            </p>
          )}

          {features.length > 0 && (
            <ul className="mestre-featured-table-features">
              {features.slice(0, 5).map((feat, i) => (
                <li key={i}>
                  <CheckCircle2 className="w-4 h-4" /> {feat}
                </li>
              ))}
            </ul>
          )}

          <div className="mestre-featured-table-footer">
            <SlotsIndicator table={table} />
            {table.price_type === 'gratuita' ? (
              <span className="mestre-featured-table-price mestre-featured-table-price--free">
                Gratuito
              </span>
            ) : table.price_value ? (
              <span className="mestre-featured-table-price">
                R$ {table.price_value}
                <span className="mestre-featured-table-price-suffix"> / sessão</span>
              </span>
            ) : null}
          </div>

          <div className="mestre-featured-table-cta-wrapper">
            <span
              className={`cta-button cta-button-large${isFull ? ' cta-button-disabled' : ''}`}
            >
              {isFull ? 'Mesa lotada' : 'Quero jogar esta aventura →'}
            </span>
          </div>
        </div>
      </Link>
    </article>
  );
}
