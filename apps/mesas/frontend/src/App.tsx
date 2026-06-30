import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { useAnalyticsPageviews } from '@artificio/analytics/react';
import { AuthProvider } from './contexts/AuthContext';
import { ProfileProvider } from './contexts/ProfileContext';
import { ConfirmProvider } from "@artificio/ui";
import { ErrorBoundary } from './components/ErrorBoundary';
import { AppShell } from './components/AppShell';
import { ProtectedRoute } from './components/ProtectedRoute';
import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/LoginPage';
import { PainelMestrePage } from './pages/PainelMestrePage';
import { OnboardingPage } from './pages/OnboardingPage';
import { CatalogoPage } from './pages/CatalogoPage';
import { MesaPage } from './pages/MesaPage';
import { MestrePage } from './pages/MestrePage';
import { PlayerPage } from './pages/PlayerPage';
import { MasterProfilePage } from './features/master/MasterProfilePage';
import ProfileEditPage from './pages/ProfileEditPage';
import { GestaoLayout } from './features/admin/components/GestaoLayout';
import { DashboardSection } from './features/admin/components/DashboardSection';
import { ConteudoSection } from './features/admin/components/ConteudoSection';
import { ComunidadeSection } from './features/admin/components/ComunidadeSection';
import { ModeracaoSection } from './features/admin/components/ModeracaoSection';
import { IntegracoesSection } from './features/admin/components/IntegracoesSection';
import { SistemaSection } from './features/admin/components/SistemaSection';
// REMOVIDO: Sistema de ingestão automática desacoplado
// import { AdminDevToolsPage } from './pages/AdminDevToolsPage';
import { Toaster } from 'react-hot-toast';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/queryClient';
import './index.css';

function AnalyticsPageviews() {
  useAnalyticsPageviews();
  return null;
}

// Redirect da rota legada /gestao/moderacao/:sub? preservando o sub
// (ex.: /gestao/moderacao/rascunhos → /gestao/mesas/rascunhos), p/ não cair
// na aba errada a partir de deep links/bookmarks antigos.
function LegacyModeracaoRedirect() {
  const { sub } = useParams<{ sub?: string }>();
  return <Navigate to={`/gestao/mesas${sub ? `/${sub}` : ''}`} replace />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/catalogo" element={<CatalogoPage />} />
      <Route path="/busca" element={<Navigate to="/catalogo" replace />} />
      <Route path="/mesas/:slug" element={<MesaPage />} />
      <Route path="/mestre/:slug" element={<MestrePage />} />
      <Route path="/jogador/:username" element={<PlayerPage />} />
      <Route path="/mestres/:masterId" element={<MasterProfilePage />} />
      <Route path="/onboarding" element={<ProtectedRoute><OnboardingPage /></ProtectedRoute>} />
      <Route path="/perfil" element={
        <ProtectedRoute>
          <ErrorBoundary>
            <ProfileProvider>
              <ProfileEditPage />
            </ProfileProvider>
          </ErrorBoundary>
        </ProtectedRoute>
      } />
      <Route path="/painel" element={<ProtectedRoute><PainelMestrePage /></ProtectedRoute>} />
      <Route path="/gestao" element={<ProtectedRoute requiredRole="admin"><GestaoLayout /></ProtectedRoute>}>
        <Route index element={<Navigate to="visao-geral" replace />} />
        {/* IA nova (057). Sections atuais reusadas como conteúdo até cada fase reescrever. */}
        <Route path="visao-geral" element={<DashboardSection />} />
        <Route path="mesas/:sub?" element={<ModeracaoSection />} />
        <Route path="catalogo" element={<ConteudoSection />} />
        <Route path="comunidade" element={<ComunidadeSection />} />
        <Route path="importacao" element={<IntegracoesSection />} />
        <Route path="sistema" element={<SistemaSection />} />
        {/* Redirects das rotas antigas — sem link morto */}
        <Route path="dashboard" element={<Navigate to="/gestao/visao-geral" replace />} />
        <Route path="conteudo" element={<Navigate to="/gestao/catalogo" replace />} />
        <Route path="moderacao/:sub?" element={<LegacyModeracaoRedirect />} />
        <Route path="integracoes" element={<Navigate to="/gestao/importacao" replace />} />
      </Route>
      {/* REMOVIDO: Sistema de ingestão automática desacoplado */}
      {/* <Route path="/admin/devtools" element={<ProtectedRoute requiredRole="admin"><AdminDevToolsPage /></ProtectedRoute>} /> */}
    </Routes>
  );
}

function App() {
  const [backendHealthy, setBackendHealthy] = React.useState<boolean | null>(null);

  // CORREÇÃO DT-012: Validar backend antes de renderizar
  React.useEffect(() => {
    const checkBackend = async () => {
      try {
        const apiUrl = import.meta.env.VITE_API_URL || '';
        const response = await fetch(`${apiUrl}/health`, {
          method: 'GET',
          signal: AbortSignal.timeout(5000)
        });
        setBackendHealthy(response.ok);
      } catch {
        setBackendHealthy(false);
      }
    };
    checkBackend();
  }, []);

  if (backendHealthy === null) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'white' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '24px', marginBottom: '16px' }}>Conectando ao backend...</div>
          <div style={{ fontSize: '14px', opacity: 0.6 }}>Aguarde</div>
        </div>
      </div>
    );
  }

  if (backendHealthy === false) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'white', backgroundColor: '#1a1a1a' }}>
        <div style={{ textAlign: 'center', maxWidth: '500px', padding: '32px' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>⏳</div>
          <div style={{ fontSize: '24px', marginBottom: '16px', fontWeight: 'bold' }}>Atualização sendo executada</div>
          <div style={{ fontSize: '14px', opacity: 0.8, marginBottom: '24px' }}>
            Estamos trazendo a versão beta para a principal, aguarde um instante para terminarmos.
          </div>
          <button 
            onClick={() => window.location.reload()} 
            style={{ padding: '12px 24px', fontSize: '16px', cursor: 'pointer', borderRadius: '8px', border: 'none', backgroundColor: '#ff6b35', color: 'white' }}
          >
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AnalyticsPageviews />
        <AuthProvider>
          <ConfirmProvider>
            <AppShell>
              <AppRoutes />
            </AppShell>
            <Toaster
              position="top-right"
              toastOptions={{
                duration: 4000,
                style: {
                  background: '#1f2937',
                  color: '#fff',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                },
              }}
            />
          </ConfirmProvider>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
