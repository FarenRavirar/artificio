interface VttPlatform {
  id: string;
  name: string;
  slug: string;
  logo_filename: string | null;
  website_url: string | null;
}

interface MestreVttPlatformsProps {
  platforms: VttPlatform[];
}

export function MestreVttPlatforms({ platforms }: MestreVttPlatformsProps) {
  if (!platforms || platforms.length === 0) {
    return null;
  }

  return (
    <section className="p-6 rounded-xl bg-white/5 border border-white/10">
      <h2 className="text-xl font-bold text-white mb-4">🎮 Plataformas que uso</h2>
      
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-4">
        {platforms.map((platform) => (
          <a
            key={platform.id}
            href={platform.website_url || '#'}
            target={platform.website_url ? '_blank' : undefined}
            rel={platform.website_url ? 'noopener noreferrer' : undefined}
            className={`
              flex flex-col items-center gap-2 p-3 rounded-lg
              ${platform.website_url 
                ? 'hover:bg-white/10 transition cursor-pointer' 
                : 'cursor-default'
              }
            `}
            title={platform.name}
          >
            {platform.logo_filename ? (
              <img
                src={`/vtt-logos/${platform.logo_filename}`}
                alt={platform.name}
                className="h-12 w-auto object-contain"
              />
            ) : (
              <div className="h-12 flex items-center justify-center">
                <span className="text-3xl">🎮</span>
              </div>
            )}
            <span className="text-xs text-white/80 text-center font-medium">
              {platform.name}
            </span>
          </a>
        ))}
      </div>
    </section>
  );
}
