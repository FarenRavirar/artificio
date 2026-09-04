interface VttPlatform {
  id: string;
  name: string;
  slug: string;
  /** `communication_platforms` não tem esta coluna (migration_166). */
  logo_filename?: string | null;
  website_url: string | null;
}

interface MestreVttPlatformsProps {
  readonly platforms: VttPlatform[];
  /**
   * Título da seção. Existe porque o perfil passou a exibir DUAS grades — as
   * VTTs e as plataformas de comunicação (migration_166) — e as duas são a
   * mesma lista de logo + nome. Uma segunda cópia do componente divergiria no
   * primeiro ajuste.
   */
  readonly title?: string;
  readonly logoBasePath?: string;
}

export function MestreVttPlatforms({
  platforms,
  title = 'Plataformas que uso',
  logoBasePath = '/vtt-logos',
}: MestreVttPlatformsProps) {
  if (!platforms || platforms.length === 0) {
    return null;
  }

  return (
    <section className="p-6 rounded-[var(--radius-lg)] bg-[var(--fill-5)] border border-[var(--border)]">
      <h3 className="text-[length:var(--text-title)] leading-[var(--leading-title)] font-[var(--weight-strong)] text-[var(--fg)] mb-4">{title}</h3>
      
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-4">
        {platforms.map((platform) => (
          <a
            key={platform.id}
            href={platform.website_url || '#'}
            target={platform.website_url ? '_blank' : undefined}
            rel={platform.website_url ? 'noopener noreferrer' : undefined}
            className={`
              flex flex-col items-center gap-2 p-3 rounded-[var(--radius-md)]
              ${platform.website_url 
                ? 'hover:bg-[var(--fill-10)] transition cursor-pointer' 
                : 'cursor-default'
              }
            `}
            title={platform.name}
          >
            {platform.logo_filename ? (
              <img
                src={`${logoBasePath}/${platform.logo_filename}`}
                alt={platform.name}
                className="h-12 w-auto object-contain"
              />
            ) : (
              // Sem logo: a inicial da plataforma, não emoji (T3.4). O emoji
              // renderiza na fonte do SO e muda de desenho entre plataformas,
              // então o mesmo perfil não fica igual para dois visitantes.
              <div className="h-12 flex items-center justify-center">
                <span className="text-[length:var(--text-title)] leading-[var(--leading-title)] font-[var(--weight-strong)] text-[var(--fg-muted)]">
                  {platform.name.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
            <span className="text-[length:var(--text-label)] leading-[var(--leading-label)] text-[var(--fg-muted)] text-center font-[var(--weight-medium)]">
              {platform.name}
            </span>
          </a>
        ))}
      </div>
    </section>
  );
}
