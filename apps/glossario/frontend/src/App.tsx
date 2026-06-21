import { lazy, Suspense, useState, useMemo, useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { Footer } from '@artificio/ui';
import { FeedbackButton } from './features/dev-feedback/FeedbackButton';
import { GlossarioHeader } from './components/GlossarioHeader';
import { SearchBar } from './components/SearchBar';
import { BuscaPage } from './pages/BuscaPage';
import { FilterPanel } from './components/FilterPanel';
import { LandingSection } from './components/LandingSection';
import { useGlossario } from './hooks/useGlossario';
import { Loader2 } from 'lucide-react';

import { AuthProvider } from './context/AuthContext';
import { useAuth } from './context/auth-context';
import { UIContext, useUI } from './context/UIContext';
import { trackSearch } from '@artificio/analytics';
import { useAnalyticsPageviews } from '@artificio/analytics/react';

// Hierarquia para ordenar variantes de um mesmo termo. Constantes de módulo
// (não dependem de render) — fora do componente p/ não entrar em deps de hooks.
const nucleusRank: Record<string, number> = { oficial: 5, artificio: 4, aprovado: 3, sugestao: 0 };
const statusRank: Record<string, number> = { verificado: 3, pendente: 1, rejeitado: 0 };
const sourceRank: Record<string, number> = { sistema: 2, cenario: 1, tabela: 0 };

const termScore = (t: { nucleus?: string; status?: string; source_type?: string }) =>
  (nucleusRank[t.nucleus ?? ''] ?? 0) * 100 +
  (statusRank[t.status ?? ''] ?? 0) * 10 +
  (sourceRank[t.source_type ?? ''] ?? 0);

const ResultCard = lazy(() => import('./components/ResultCard'));
const AddTermModal = lazy(() => import('./components/AddTermModal'));
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const MigrationPage = lazy(() => import('./pages/MigrationPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const NotificationsPage = lazy(() => import('./pages/NotificationsPage'));
const ImportPage = lazy(() => import('./pages/ImportPage'));
const AdminUsersPage = lazy(() => import('./pages/AdminUsersPage'));
const AdminReviewPage = lazy(() => import('./pages/AdminReviewPage'));
const AdminStructurePage = lazy(() => import('./pages/AdminStructurePage'));
const AdminActivityPage = lazy(() => import('./pages/AdminActivityPage'));
const AdminFeedbackPage = lazy(() => import('./pages/AdminFeedbackPage'));

function HomePage() {
  const { user } = useAuth();
  const { openAddTerm } = useUI();
  const { dados, buscar, loading, error, recarregar, editarTermo, excluirTermo } = useGlossario();
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const queryWasActiveRef = useRef(false);
  const isAdmin = user?.role === 'admin';
  const hasSearchQuery = query.trim().length >= 2;

  // Rastreia buscas no GA4 com debounce de 800ms
  useEffect(() => {
    if (!query || query.trim().length < 2) return;
    const timer = setTimeout(() => {
      trackSearch(query);
      void buscar(query);
    }, 800);
    return () => clearTimeout(timer);
  }, [buscar, query]);

  useEffect(() => {
    if (query.trim().length > 0) {
      queryWasActiveRef.current = true;
      return;
    }
    if (queryWasActiveRef.current) {
      queryWasActiveRef.current = false;
      recarregar();
    }
  }, [query, recarregar]);

  // -------------------------------------------------------------------------
  // Filtro de resultados
  // -------------------------------------------------------------------------
  const filteredResults = useMemo(() => {
    if (!query && !activeCategory) return [];
    if (query && !hasSearchQuery) return [];
    let results = dados;
    if (activeCategory) {
      results = results.filter(item =>
        item.category_name === activeCategory ||
        item.subcategory_name === activeCategory ||
        item.subcategoria === activeCategory ||
        item.categoria === activeCategory
      );
    }
    return results;
  }, [query, hasSearchQuery, activeCategory, dados]);

  // Agrupa por name_en normalizado; primeiro da lista = maior hierarquia
  const groupedResults = useMemo(() => {
    const map = new Map<string, typeof filteredResults>();
    for (const t of filteredResults) {
      const key = (t.name_en || t.nome_en || '').toLowerCase().trim();
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(t);
    }
    return Array.from(map.values()).map(group =>
      [...group].sort((a, b) => termScore(b) - termScore(a))
    );
  }, [filteredResults]);


  const categories = useMemo(() => {
    const cats = new Set(
      dados.flatMap((item) => [item.category_name, item.subcategory_name, item.subcategoria, item.categoria]).filter(Boolean)
    );
    const unwanted = ["NÃO VALIDADO RECENTEMENTE", "DEFINIR DOMINIO", "DEFINIR SUBDOMINIO", "DEFINIR DOMÍNIO", "DEFINIR SUBDOMÍNIO", "INFORMAL"];
    const filteredCats = Array.from(cats).filter((c): c is string => !!c && !unwanted.includes(c.toUpperCase()));
    return filteredCats.sort();
  }, [dados]);

  const isSearching = hasSearchQuery || !!activeCategory;

  return (
    <div className="w-full max-w-5xl mx-auto px-4 py-8">

      {/* Hero Badge sempre no topo (mesmo se buscando ou não, para manter a consistência, ou apenas na landing?) 
          Como pedido, a busca fica abaixo do presente e acima do título. */}
      {!isSearching && (
        <div className="text-center pt-4 md:pt-6 mb-8">
          <div className="inline-flex items-center gap-2 bg-[rgba(255,87,34,0.10)] text-[var(--artificio-brand)] text-xs font-bold uppercase tracking-widest px-4 py-2 rounded-full border border-[rgba(255,87,34,0.20)]">
            {/* Sparkles inline para evitar imports extras no App */}
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>
            Um presente da Artifício RPG para a comunidade
          </div>
        </div>
      )}

      {/* Busca fica logo abaixo do badge, sempre centralizada no topo */}
      <section id="buscar" className="mb-10 max-w-3xl mx-auto">
        <SearchBar onSearch={setQuery} />
      </section>

      {/* O resto da Landing Section (Título, CTAs e Cards) só aparece sem busca */}
      {!isSearching && (
        <LandingSection totalTermos={dados.length} isAuthenticated={!!user} onContribute={openAddTerm} />
      )}

      {/* Filtros só aparecem quando o usuário já está pesquisando */}
      {isSearching && (
        <section className="mb-8">
          <FilterPanel 
            categories={categories} 
            activeCategory={activeCategory} 
            onSelectCategory={setActiveCategory} 
          />
        </section>
      )}

      <section className="grid gap-4">
        {loading && (
          <div className="flex flex-col items-center justify-center p-12 text-[var(--fg)]">
            <Loader2 className="animate-spin mb-4" size={48} />
            <p className="font-semibold text-lg">Carregando Glossário...</p>
          </div>
        )}

        {error && (
          <div className="bg-[var(--state-danger-bg)] border-2 border-[var(--state-danger-line)] text-[var(--state-danger-fg)] p-6 rounded-lg text-center">
            <p className="font-bold text-xl mb-2">Ops! Algo deu errado.</p>
            <p>{error}</p>
          </div>
        )}

        {!loading && !error && (
          <>
            {filteredResults.length > 0 && (
              <div className="text-sm text-[var(--fg-muted)] mb-2 px-2">
                Exibindo {filteredResults.length} resultado{filteredResults.length !== 1 ? 's' : ''}
                {groupedResults.length !== filteredResults.length && (
                  <span className="ml-1 text-[var(--fg-muted)]">({groupedResults.length} termo{groupedResults.length !== 1 ? 's' : ''} únicos)</span>
                )}
              </div>
            )}
            
            <Suspense fallback={<RouteLoading />}>
              {groupedResults.map((group) => {
                const primary = group[0];
                const variants = group.slice(1);

                return (
                  <div key={primary.id} className="space-y-1">
                    <ResultCard
                      termo={primary}
                      isAdmin={isAdmin}
                      onSave={editarTermo}
                      onDelete={excluirTermo}
                    />

                    {/* Variantes (duplicatas) colapsáveis */}
                    {variants.length > 0 && (
                      <details className="group">
                        <summary className="cursor-pointer list-none flex items-center gap-2 px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest text-[var(--fg-muted)] hover:text-[var(--fg)] transition-colors">
                          <svg className="w-3 h-3 transition-transform group-open:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                          </svg>
                          {variants.length} outr{variants.length === 1 ? 'a versão' : 'as versões'} deste termo
                        </summary>
                        <div className="mt-1 ml-6 space-y-1 border-l-2 border-[var(--line)] pl-3">
                          {variants.map((v) => (
                            <ResultCard
                              key={v.id}
                              termo={v}
                              isAdmin={isAdmin}
                              onSave={editarTermo}
                              onDelete={excluirTermo}
                            />
                          ))}
                        </div>
                      </details>
                    )}
                  </div>
                );
              })}
            </Suspense>

            {isSearching && filteredResults.length === 0 && (
              <div className="bg-[var(--surface)] p-12 rounded-lg border-2 border-dashed border-[var(--line)] text-center">
                <p className="text-2xl font-bold text-[var(--fg)] mb-2">Nenhum termo encontrado</p>
                <p className="text-[var(--fg-muted)]">Tente buscar por outro termo ou limpe os filtros.</p>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}

// Tela de espera enquanto a sessão SSO resolve (/auth/me). Sem isso, num reload
// full (links do userMenu são <a href>), o guard veria user=null durante o load
// e redirecionaria a /login mesmo logado.
function RouteLoading() {
  return (
    <div className="flex items-center justify-center p-16 text-[var(--fg)]">
      <Loader2 className="animate-spin" size={40} />
    </div>
  );
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <RouteLoading />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'admin') return <Navigate to="/" replace />;
  return <>{children}</>;
}

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <RouteLoading />;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function AnalyticsPageviews() {
  useAnalyticsPageviews();
  return null;
}

function App() {
  const [addTermOpen, setAddTermOpen] = useState(false);

  return (
    <UIContext.Provider value={{ openAddTerm: () => setAddTermOpen(true) }}>
      <AuthProvider>
        <BrowserRouter>
          <AnalyticsPageviews />
          <div className="min-h-screen flex flex-col bg-[var(--surface-subtle)] font-sans">
            <GlossarioHeader />
            <main className="flex-1">
              <Suspense fallback={<RouteLoading />}>
                <Routes>
                  <Route path="/" element={<HomePage />} />
                  <Route path="/login" element={<Login />} />
                  <Route path="/register" element={<Register />} />
                  <Route path="/migrar" element={<MigrationPage />} />
                  <Route path="/perfil" element={<PrivateRoute><ProfilePage /></PrivateRoute>} />
                  <Route path="/busca" element={<BuscaPage />} />
                  <Route path="/profile" element={<Navigate to="/perfil" replace />} />
                  <Route path="/notificacoes" element={<PrivateRoute><NotificationsPage /></PrivateRoute>} />
                  <Route path="/importar" element={<PrivateRoute><ImportPage /></PrivateRoute>} />
                  <Route path="/admin/review" element={<AdminRoute><AdminReviewPage /></AdminRoute>} />
                  <Route path="/admin/users" element={<AdminRoute><AdminUsersPage /></AdminRoute>} />
                  <Route path="/admin/structure" element={<AdminRoute><AdminStructurePage /></AdminRoute>} />
                  <Route path="/admin/activity" element={<AdminRoute><AdminActivityPage /></AdminRoute>} />
                  <Route path="/admin/feedback" element={<AdminRoute><AdminFeedbackPage /></AdminRoute>} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </Suspense>
            </main>

            {addTermOpen && (
              <Suspense fallback={null}>
                <AddTermModal
                  onClose={() => setAddTermOpen(false)}
                  onSuccess={() => setAddTermOpen(false)}
                />
              </Suspense>
            )}

            <Footer variant="dark" />
            <FeedbackButton />
          </div>
          <Toaster position="bottom-center" />
        </BrowserRouter>
      </AuthProvider>
    </UIContext.Provider>
  );
}

export default App;
