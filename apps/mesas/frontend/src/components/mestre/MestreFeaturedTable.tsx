import { Link } from 'react-router-dom';
import { CheckCircle2, Star, Globe, MapPin } from 'lucide-react';
import type { TableCard } from '../../types/tables';
import { SlotsIndicator } from '../SlotsIndicator';
import { SystemBadge } from '../SystemBadge';
import { CertificationBadges } from '../CertificationBadges';
import { getSlotsVisualState } from '../../utils/slots';
import { applyTableImageFallback, resolveTableImageSource } from '../../utils/tableImage';

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
          <img
            src={resolveTableImageSource(table.cover_url)}
            alt={table.title}
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
                className="absolute bottom-3 right-3 h-9 min-w-9 px-2 rounded-lg bg-black/55 border border-white/20 backdrop-blur-sm inline-flex items-center justify-center hover:bg-black/70 hover:border-white/40 transition-colors"
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
                className="absolute bottom-3 right-3 h-9 min-w-9 px-2 rounded-lg bg-black/55 border border-white/20 backdrop-blur-sm inline-flex items-center justify-center"
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
                className="!bg-transparent !border-white/20"
              />
            )}
            <span className="mestre-featured-table-tag">
              {table.modality === 'online' ? <Globe className="w-3 h-3" /> : <MapPin className="w-3 h-3" />}
              {modalityLabels[table.modality] ?? table.modality}
            </span>
          </div>

          <h3 className="mestre-featured-table-title">{table.title}</h3>

          {table.description && (
            <p className="mestre-featured-table-description">{table.description}</p>
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
