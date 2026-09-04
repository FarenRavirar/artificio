import { useState, type CSSProperties } from 'react';
import { useBannerScrim } from './useBannerScrim';
import { CheckCircle2, Medal, Sparkles, Crown, Award, Users, Star, MessageSquare } from 'lucide-react';
import type { TableCard } from '../../types/tables';
import type { MestrePublicData } from '../../hooks/useMestre';
import { isUsableImageSrc } from '../../utils/imageSource';
import { cropToObjectPosition } from '@artificio/media/image-kinds';
import { Badge, toFiniteNumber, type BadgeVariant } from '@artificio/ui';
// Spec 099 B10: o hero carrega o PRÓPRIO CSS (movido de MestrePage.css) para
// que a prévia dos editores (MestreProfilePreview) consuma o componente real
// com os mesmos estilos — sem importar a página pública inteira, cujas classes
// (.container, .section-title) colidem com os editores.
import './MestreHero.css';

interface MestreHeroProps {
  profile: MestrePublicData;
  mappedTables: TableCard[];
  totalOpenSlots: number;
}

/**
 * Apoio da dobra, não fallback da tagline: §2.3 põe a `tagline` no `h1` **e**
 * mantém a 1ª frase da bio abaixo. A primeira versão de C1 condicionava este
 * resumo a `!tagline`, então o perfil que preenchesse os dois campos perdia a
 * bio da dobra — justamente o perfil mais completo (achado de review, PR #302).
 *
 * Fora do componente e sem ternário de default (segundo achado da mesma
 * rodada): a guarda de entrada devolve `null` direto, e a função não é
 * recriada a cada render.
 */
function summarizeBio(bioLong: string | null | undefined): string | null {
  if (!bioLong) return null;

  const firstSentence = bioLong.split(/[.!?]\s+/)[0];
  if (firstSentence.length > 140) return `${firstSentence.slice(0, 140)}…`;
  return firstSentence + (bioLong.includes('.') ? '.' : '');
}

export function MestreHero({ profile, mappedTables }: MestreHeroProps) {
  // Defesa secundária: a normalização primária de `avg_rating` vive em
  // `normalizeMestreProfile` (useMestre.ts), na entrada do estado. Mantida aqui
  // porque o componente aceita `MestrePublicData` de qualquer origem, e o campo
  // é NUMERIC(3,2) — o parser default do `pg` entrega string, que já derrubou o
  // catálogo em produção via `.toFixed()`.
  const avgRating = toFiniteNumber(profile.avg_rating);

  const hasAnyStat =
    (profile.tables_count ?? 0) > 0 ||
    (avgRating ?? 0) > 0 ||
    (profile.reviews_count ?? 0) > 0;

  // `tables_count` saiu desta conta junto com o selo que o exibia (spec 100):
  // deixá-lo aqui faria a linha inteira renderizar VAZIA para o mestre que só
  // tem mesas ativas e nenhum outro selo — condição verdadeira, nenhum filho.
  const hasAnyTrust =
    profile.covil_verified ||
    (profile.experience_years ?? 0) >= 3 ||
    (profile.years_on_platform ?? 0) >= 1 ||
    (profile.tables_hosted_count ?? 0) > 0;

  const scrollTo = (id: string) => () => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  // Guarda a URL que falhou (nao um booleano): assim o reset e automatico
  // quando a prop muda, sem efeito nenhum.
  const [bannerFailure, setBannerFailure] = useState<string | null>(null);
  const [avatarFailure, setAvatarFailure] = useState<string | null>(null);

  // A falha pertence a URL que falhou, nao ao componente: trocar a imagem tem
  // que dar nova chance ao `<img>`, senao o placeholder fica preso ate
  // desmontar. Vale em qualquer navegacao entre mestres, e ficou visivel com a
  // previa do editor (B10), que re-renderiza a cada troca de foto: uma URL
  // quebrada deixava o mestre sem ver a foto que acabou de subir.
  //
  // Guardamos a URL JUNTO do estado e comparamos no render, em vez de resetar
  // por `useEffect`: efeito com `setState` sincrono dispara render em cascata
  // (reprovado por `react-hooks`), e o ajuste durante o render e o padrao que
  // o React recomenda para estado derivado de prop.
  const bannerFailed = bannerFailure === profile.banner_url;
  const avatarFailed = avatarFailure === profile.avatar_url;
  const tagline = profile.tagline?.trim() || null;
  const bioSummary = summarizeBio(profile.bio_long);

  // A dobra é um resumo, não a morada completa dos atributos: dois valores por
  // categoria preservam as três categorias fechadas de D2 sem empurrar CTA e
  // prova para fora da primeira tela. As seções abaixo continuam exibindo tudo.
  const heroAttributeGroups: Array<{
    key: 'specialties' | 'selling_points' | 'languages';
    variant: BadgeVariant;
    values: string[];
  }> = [
    {
      key: 'specialties',
      variant: 'warning',
      values: (Array.isArray(profile.specialties) ? profile.specialties : []).slice(0, 2),
    },
    {
      key: 'selling_points',
      variant: 'brand',
      values: (Array.isArray(profile.selling_points) ? profile.selling_points : [])
        .slice(0, 2)
        .map((point) => point.title),
    },
    {
      key: 'languages',
      variant: 'info',
      values: (Array.isArray(profile.languages) ? profile.languages : []).slice(0, 2),
    },
  ];
  const hasHeroAttributes = heroAttributeGroups.some((group) => group.values.length > 0);

  const mostraBanner = isUsableImageSrc(profile.banner_url) && !bannerFailed;
  const scrim = useBannerScrim(mostraBanner ? profile.banner_url : null);
  const scrimVars = {
    '--hero-scrim-top': scrim.top,
    '--hero-scrim-bottom': scrim.bottom,
    '--hero-scrim-left': scrim.left,
    '--hero-scrim-right': scrim.right,
  } as CSSProperties;

  return (
    <section
      className="hero-section"
      // O véu sobre a foto se dimensiona pela imagem que o mestre escolheu
      // (`useBannerScrim`), em vez de um valor fixo que serve à foto escura e
      // apaga o texto na clara. Recalculado a cada carga, porque o banner muda
      // quando ele quiser. Sem banner, as variáveis não são escritas e o CSS
      // usa os defaults de hoje.
      style={scrimVars}
    >
      {isUsableImageSrc(profile.banner_url) && !bannerFailed ? (
        <img
          src={profile.banner_url}
          alt=""
          className="hero-banner"
          // SEM `crossOrigin` aqui, de propósito. A medição do véu já usa um
          // `new Image()` próprio com o atributo (`useBannerScrim`), então
          // colocá-lo também no `<img>` VISÍVEL não acrescenta nada e ainda
          // arrisca a exibição: o browser recusa desenhar imagem cujo servidor
          // não manda `Access-Control-Allow-Origin`. Medido (2026-09-04):
          // `gstatic.com` exibe sem o atributo e QUEBRA com ele. O banner pode
          // vir de qualquer origem, porque o editor aceita "cole um link direto
          // de imagem" — então o atributo aqui apagaria o banner de quem usa
          // servidor sem CORS. Falha de medição já cai no scrim padrão; falha
          // de exibição não tem plano B (achado de review, PR #307).
          // Enquadramento escolhido pelo mestre. Sem `object-position` o
          // `object-fit: cover` do CSS recorta sempre pelo centro geometrico,
          // sem que ninguem possa escolher o que fica visivel.
          style={{
            objectPosition: cropToObjectPosition(
              profile.banner_crop_data,
              profile.banner_width,
              profile.banner_height,
            ),
          }}
          onError={() => setBannerFailure(profile.banner_url ?? null)}
        />
      ) : (
        <div className="hero-banner-gradient" />
      )}
      <div className="hero-overlay" />

      <div className="hero-content">
        {profile.promo_badge_text && (
          <div className="hero-promo-badge">
            <Sparkles className="w-4 h-4" />
            <span>{profile.promo_badge_text}</span>
          </div>
        )}

        {/* Faixa de identificação (T3.1/D5): foto ao lado de nome, título e
            selos, em vez de foto centralizada acima de um título de landing. */}
        <div className="hero-identity">
          <div className="hero-avatar">
            {isUsableImageSrc(profile.avatar_url) && !avatarFailed ? (
              <img
                src={profile.avatar_url}
                alt={profile.display_name}
                style={{
                  objectPosition: cropToObjectPosition(
                    profile.avatar_crop_data,
                    profile.avatar_width,
                    profile.avatar_height,
                  ),
                }}
                onError={() => setAvatarFailure(profile.avatar_url ?? null)}
              />
            ) : (
              <div className="hero-avatar-placeholder">
                {profile.display_name.charAt(0).toUpperCase()}
              </div>
            )}
          </div>

          <div className="hero-headline">
            {tagline && <p className="hero-master-name">{profile.display_name}</p>}

            <h1 className="hero-title">
              {tagline ? (
                tagline
              ) : (
                <>
                  Viva aventuras com{' '}
                  <span className="hero-title-accent">{profile.display_name}</span>
                </>
              )}
            </h1>

            <div className="hero-badges">
              <Badge variant="warning" className="gap-2">
                <Crown className="w-4 h-4" /> Mestre
              </Badge>
              {profile.covil_verified && (
                <Badge variant="warning" className="gap-2">
                  <Award className="w-4 h-4" /> Mestre do Covil
                </Badge>
              )}
            </div>
          </div>
        </div>

        {bioSummary && <p className="hero-bio">{bioSummary}</p>}

        {hasHeroAttributes && (
          <div className="hero-attributes" aria-label="Atributos principais do mestre">
            {heroAttributeGroups.flatMap((group) =>
              group.values.map((value, index) => (
                <Badge key={`${group.key}-${index}-${value}`} variant={group.variant}>
                  {value}
                </Badge>
              )),
            )}
          </div>
        )}

        <div className="hero-ctas">
          <button
            type="button"
            className="cta-button cta-primary"
            onClick={scrollTo('contato')}
          >
            Entrar em contato
          </button>
          {mappedTables.length > 0 && (
            <button
              type="button"
              className="cta-button cta-secondary"
              onClick={scrollTo('mesas')}
            >
              Ver mesas disponíveis
            </button>
          )}
        </div>

        {hasAnyTrust && (
          <div className="hero-trust-row">
            {/* "N mesas ativas" saiu daqui (spec 100): a mesma `tables_count`
                aparecia como selo de confiança E como número em `hero-stats`
                logo abaixo — o visitante lia "8 mesas ativas" e "8 Mesas" na
                mesma dobra. O dado ficou só na stat, que agora se rotula
                "Mesas Ativas". Medido em beta 2026-09-04. */}
            {profile.covil_verified && (
              <span className="trust-item" data-testid="trust-covil">
                <CheckCircle2 className="w-4 h-4" />
                Verificado no Covil
              </span>
            )}
            {/* Spec 099: `experience_years` é autodeclarado pelo mestre — ícone
                Medal e rótulo "Declara N+ anos" para não parecer verificado
                pela plataforma (só `covil_verified` usa CheckCircle2). */}
            {(profile.experience_years ?? 0) >= 3 && (
              <span className="trust-item" data-testid="trust-experience">
                <Medal className="w-4 h-4" />
                Declara {profile.experience_years}+ anos de experiência
              </span>
            )}
            {/* T9.1 (spec 081): calculado (created_at), rótulo distinto do
                autodeclarado acima para não confundir os dois dados (achado D2). */}
            {(profile.years_on_platform ?? 0) >= 1 && (
              <span className="trust-item">
                <CheckCircle2 className="w-4 h-4" />
                Na plataforma desde {new Date(profile.created_at).getFullYear()}
              </span>
            )}
            {(profile.tables_hosted_count ?? 0) > 0 && (
              <span className="trust-item">
                <CheckCircle2 className="w-4 h-4" />
                {/* "no Artifício", não "publicadas" (decisão do mantenedor):
                    `tables_hosted_count` é `COUNT(*)` SEM filtro de status
                    (`gm.ts:180`), então inclui rascunho, cancelada e
                    encerrada. Medido em produção: existe 1 rascunho, que já
                    seria anunciado como publicado. O rótulo nomeia o total
                    histórico do mestre na plataforma sem afirmar estado
                    nenhum sobre as mesas (achado de review, PR #307). */}
                {profile.tables_hosted_count} {profile.tables_hosted_count === 1 ? 'mesa no Artifício' : 'mesas no Artifício'}
              </span>
            )}
          </div>
        )}

        {hasAnyStat && (
          <div className="hero-stats">
            {(profile.tables_count ?? 0) > 0 && (
              <div className="stat">
                <Users className="stat-icon" />
                <span className="stat-value">{profile.tables_count}</span>
                <span className="stat-label">
                  {profile.tables_count === 1 ? 'Mesa Ativa' : 'Mesas Ativas'}
                </span>
              </div>
            )}
            {(avgRating ?? 0) > 0 && (
              <div className="stat">
                <Star className="stat-icon" />
                <span className="stat-value">{avgRating!.toFixed(1)}★</span>
                <span className="stat-label">Avaliação</span>
              </div>
            )}
            {(profile.reviews_count ?? 0) > 0 && (
              <div className="stat">
                <MessageSquare className="stat-icon" />
                <span className="stat-value">{profile.reviews_count}</span>
                <span className="stat-label">
                  {profile.reviews_count === 1 ? 'Avaliação' : 'Avaliações'}
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
