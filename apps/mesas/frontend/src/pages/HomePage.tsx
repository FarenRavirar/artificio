import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useFetchTables } from '../hooks/useFetchTables';
import { TableCardComponent, TableCardSkeleton } from '../components/TableCard';
import { Search, Megaphone } from 'lucide-react';
import { applySeo } from '../utils/seo';
import { useAuth } from '../contexts/useAuth';
import { startSsoLogin } from '../utils/auth';

const SUGGESTIONS = ['D&D 5e', 'Ordem Paranormal', 'Vampiro', 'Tormenta'];

// Tracking global
const track = (event: string, data?: unknown) => {
  console.log('[TRACK]', event, data);
};

export const HomePage = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [searchInput, setSearchInput] = useState('');
  const [activeSearch, setActiveSearch] = useState('');
  const [activeSeal, setActiveSeal] = useState<'ddal' | 'covil-do-lich' | ''>(''); // CORREÇÃO HP-11

  const { tables, isLoading, error, totalCount } = useFetchTables({ 
    limit: 12, 
    search: activeSearch || undefined,
    seal: activeSeal || undefined // CORREÇÃO HP-11
  });

  useEffect(() => {
    applySeo(
      'Artifício Mesas | Descubra sua próxima aventura',
      'Catálogo colaborativo para descobrir e publicar mesas de RPG online e presenciais com filtros avançados.'
    );
    track('hero_view', { page: 'home' });
  }, []);

  // Detecção de drop-off
  useEffect(() => {
    if (!tables.length && activeSearch && !isLoading) {
      track('empty_result', { term: activeSearch });
    }
  }, [tables, activeSearch, isLoading]);

  const handleSearch = () => {
    const term = searchInput.trim();
    setActiveSearch(term);
    track('search', { term });
  };

  const handleSuggestionClick = (suggestion: string) => {
    setSearchInput(suggestion);
    setActiveSearch(suggestion);
    track('suggestion_click', { term: suggestion });
  };

  const handleAnnounceTable = () => {
    track('announce_table_click', { authenticated: isAuthenticated });
    if (isAuthenticated) {
      navigate('/painel?action=nova-mesa');
    } else {
      startSsoLogin('/painel?action=nova-mesa');
    }
  };

  return (
    <main className="bg-[var(--color-artificio-blue)] font-sans text-white">
      {/* HERO */}
      <section className="relative w-full py-16 lg:py-20 overflow-hidden">
        <div className="orange-glow" />
        <div className="container mx-auto px-6 text-center space-y-6 relative z-10">

          {/* EYEBROW — prova social dinâmica */}
          <p className="eyebrow">
            ◆ {totalCount ?? tables.length}+ mesas abertas · comunidade Artifício RPG
          </p>

          {/* HEADLINE */}
          <h1 className="text-4xl lg:text-6xl font-extrabold tracking-tight">
            Encontre uma mesa de RPG em <span className="text-[var(--color-artificio-orange)]">30 segundos</span>
          </h1>

          {/* SUBTÍTULO */}
          <p className="text-base text-white/70 max-w-xl mx-auto leading-relaxed">
            D&amp;D, Tormenta, Vampiro e dezenas de outros sistemas. Online ou presencial.
            De mestres da comunidade Artifício e parceiros.
          </p>

          {/* BUSCA */}
          <div className="glass max-w-2xl mx-auto mt-6 p-2 rounded-full flex items-center shadow-2xl focus-within:ring-2 focus-within:ring-[var(--color-artificio-orange)]/50 transition-all">
            <Search className="w-6 h-6 text-white/50 ml-4 hidden sm:block" />
            <input
              id="input-busca-mesas"
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Ex: D&D, Vampiro, Mesa iniciante..."
              className="flex-1 bg-transparent border-none outline-none px-4 py-3 text-white placeholder-white/50"
            />
            <button
              id="btn-buscar-mesas"
              onClick={handleSearch}
              className="bg-[var(--color-artificio-orange)] hover:bg-[var(--color-artificio-orange-hover)] text-white px-6 py-3 rounded-full font-semibold transition-colors duration-200 cursor-pointer"
            >
              {isLoading ? 'Buscando...' : 'Buscar'}
            </button>
          </div>

          {/* ANUNCIAR MESA */}
          <div className="flex justify-center mt-4">
            <button
              id="btn-anunciar-mesa-home"
              onClick={handleAnnounceTable}
              className="flex items-center gap-2 px-5 py-3 bg-[var(--color-artificio-orange)] hover:bg-[var(--color-artificio-orange-hover)] text-white font-semibold rounded-full transition-colors duration-200 cursor-pointer"
            >
              <Megaphone className="w-5 h-5" />
              Anunciar Mesa
            </button>
          </div>

          {/* SUGESTÕES */}
          <div className="flex flex-wrap justify-center gap-2 mt-4">
            {SUGGESTIONS.map((item) => (
              <button
                key={item}
                onClick={() => handleSuggestionClick(item)}
                className="px-3 py-1 text-sm rounded-full bg-white/10 hover:bg-white/20 transition-colors"
              >
                {item}
              </button>
            ))}
          </div>

          {/* FILTROS DE SELOS */}
          <div className="flex flex-wrap justify-center gap-2 mt-2">
            <button
              onClick={() => setActiveSeal('')}
              className={`px-3 py-1 text-xs rounded-full transition-colors ${
                activeSeal === ''
                  ? 'bg-[var(--color-artificio-orange)] text-white font-semibold'
                  : 'bg-white/10 hover:bg-white/20 text-white/70'
              }`}
            >
              Todas as mesas
            </button>
            <button
              onClick={() => setActiveSeal('ddal')}
              className={`px-3 py-1 text-xs rounded-full transition-colors flex items-center gap-1 ${
                activeSeal === 'ddal'
                  ? 'bg-amber-500 text-white font-semibold'
                  : 'bg-white/10 hover:bg-white/20 text-white/70'
              }`}
            >
              🛡️ DDAL
            </button>
            <button
              onClick={() => setActiveSeal('covil-do-lich')}
              className={`px-3 py-1 text-xs rounded-full transition-colors flex items-center gap-1 ${
                activeSeal === 'covil-do-lich'
                  ? 'bg-purple-500 text-white font-semibold'
                  : 'bg-white/10 hover:bg-white/20 text-white/70'
              }`}
            >
              👑 Covil do Lich
            </button>
            <Link
              to="/catalogo?priceType=gratuita"
              className="px-3 py-1 text-xs rounded-full bg-white/10 hover:bg-white/20 text-white/70 transition-colors"
            >
              Gratuitas
            </Link>
          </div>

        </div>
      </section>

      <section className="container mx-auto px-6 pb-24">
        <div className="flex items-center justify-between mb-8 gap-4">
          <h2 className="text-2xl font-bold tracking-wide">
            {activeSearch ? `Resultados para "${activeSearch}"` : 'Abertas Recentemente'}
          </h2>
          <Link
            to="/catalogo"
            className="text-sm px-4 py-2 rounded-lg border border-white/15 hover:border-[var(--color-artificio-orange)] hover:text-[var(--color-artificio-orange)] transition-colors"
            id="btn-ver-catalogo-completo-home"
          >
            Ver catálogo completo
          </Link>
        </div>

        {error && (
          <div className="text-center py-20 text-red-400">
            <p>{error}</p>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {isLoading
            ? Array.from({ length: 6 }).map((_, i) => <TableCardSkeleton key={i} />)
            : tables.length > 0
              ? tables.map(t => (
                  <div
                    key={t.id}
                    onClick={() => track('click_card', { 
                      tableId: t.id, 
                      slotsLeft: t.slots_open ?? 0, // CORREÇÃO HP-08: Usar slots_open
                      price: t.price_value 
                    })}
                  >
                    <TableCardComponent table={t} />
                  </div>
                ))
              : !error && (
                <div className="col-span-3 text-center py-20 text-white/40">
                  <p className="text-4xl mb-4">🗺️</p>
                  {/* CORREÇÃO HP-13: Diferenciar busca vazia de catálogo vazio */}
                  {activeSearch ? (
                    <>
                      <p className="text-lg font-medium">Nenhuma mesa encontrada para "{activeSearch}".</p>
                      <p className="text-sm mt-2">Tente buscar por outro sistema ou termo.</p>
                    </>
                  ) : (
                    <>
                      <p className="text-lg font-medium">Nenhuma mesa aberta no momento.</p>
                      <p className="text-sm mt-2">Seja o primeiro a publicar uma aventura!</p>
                    </>
                  )}
                </div>
              )}
        </div>
      </section>
    </main>
  );
};
