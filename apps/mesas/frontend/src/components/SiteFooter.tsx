export const SiteFooter = () => {
  return (
    <footer className="mt-24 border-t border-white/10 bg-[var(--surface-deep)] text-white/75">
      <div className="mx-auto w-full max-w-7xl px-6 pt-16 pb-12">
        <div className="grid grid-cols-1 md:grid-cols-[1.5fr_1fr_1fr] gap-y-12 md:gap-x-12 lg:gap-x-16">

          {/* Coluna 1: Marca */}
          <section aria-labelledby="footer-brand-title" className="max-w-sm">
            <h2 id="footer-brand-title" className="flex items-center gap-2 text-base font-bold text-white">
              <span className="text-[var(--color-artificio-orange)]">Artifício</span>Mesas
            </h2>
            <p className="mt-4 text-sm leading-7 text-white/60 max-w-xs">
              Conectando mestres e jogadores em mesas de RPG no Brasil.
              Iniciativa do Artifício RPG, comunidade desde 2014.
            </p>
            <ul className="mt-5 space-y-2.5 text-sm text-white/70">
              <li id="footer-commitment-free" className="flex items-center gap-2">
                <span className="text-emerald-400 text-xs">✓</span>
                100% gratuito para sempre
              </li>
              <li id="footer-commitment-no-ads" className="flex items-center gap-2">
                <span className="text-amber-400 text-xs">✓</span>
                Sem anúncios
              </li>
              <li id="footer-commitment-privacy" className="flex items-center gap-2">
                <span className="text-sky-400 text-xs">✓</span>
                Sem coleta desnecessária de dados
              </li>
            </ul>
          </section>

          {/* Coluna 2: Comunidade */}
          <section aria-labelledby="footer-community-title" className="md:justify-self-start">
            <h2 id="footer-community-title" className="eyebrow mb-5">
              Comunidade
            </h2>
            <ul className="space-y-3 text-sm">
              {[
                { label: 'Discord', href: 'https://discord.gg/artificiorpg', id: 'footer-link-discord' },
                { label: 'Instagram', href: 'https://instagram.com/artificiorpg', id: 'footer-link-instagram' },
                { label: 'YouTube', href: 'https://youtube.com/@artificiorpg', id: 'footer-link-youtube' },
                { label: 'GitHub', href: 'https://github.com/FarenRavirar/mesas_rpg_artificio', id: 'footer-link-github' },
              ].map(({ label, href, id }) => (
                <li key={id}>
                  <a
                    id={id}
                    href={href}
                    target="_blank"
                    rel="noreferrer"
                    className="text-white/70 hover:text-white transition-colors"
                  >
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </section>

          {/* Coluna 3: Para mestres */}
          <section aria-labelledby="footer-gm-title" className="md:justify-self-start">
            <h2 id="footer-gm-title" className="eyebrow mb-5">
              Para mestres
            </h2>
            <ul className="space-y-3 text-sm">
              {[
                { label: 'Como abrir uma mesa', href: '/painel', id: 'footer-link-open-table' },
                { label: 'Programa Covil do Lich', href: '/catalogo?seal=covil-do-lich', id: 'footer-link-covil' },
                { label: 'Selo DDAL', href: '/catalogo?seal=ddal', id: 'footer-link-ddal' },
                { label: 'Ver no GitHub', href: 'https://github.com/FarenRavirar/mesas_rpg_artificio', id: 'footer-link-opensource' },
              ].map(({ label, href, id }) => (
                <li key={id}>
                  <a
                    id={id}
                    href={href}
                    className="text-white/70 hover:text-white transition-colors"
                    {...(href.startsWith('http') ? { target: '_blank', rel: 'noreferrer' } : {})}
                  >
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </section>

        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="mx-auto w-full max-w-7xl px-6 py-7 text-xs text-white/40 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <span>© {new Date().getFullYear()} Artifício RPG · Feito com 🎲 no Brasil</span>
          <a
            id="footer-link-artificio"
            href="https://artificiorpg.com"
            target="_blank"
            rel="noreferrer"
            className="text-white/55 hover:text-white transition-colors"
          >
            artificiorpg.com
          </a>
        </div>
      </div>
    </footer>
  );
};
