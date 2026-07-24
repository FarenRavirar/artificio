import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAnalyticsPageviews } from '@artificio/analytics/react';
import { HomePage } from './pages/HomePage';
import { SobreEUsoPage } from './pages/SobreEUsoPage';
import { CatalogoPage } from './pages/CatalogoPage';
import { MaterialPage } from './pages/MaterialPage';
import { CreatorPage } from './pages/CreatorPage';
import { RedirectDestinationPage } from './pages/RedirectDestinationPage';
import { ObterArquivoPage } from './pages/ObterArquivoPage';
import { RequireAuth } from './components/RequireAuth';
import { VisaoGeralPage } from './pages/painel/VisaoGeralPage';
import { MeusMateriaisPage } from './pages/painel/MeusMateriaisPage';
import { NovoMaterialPage } from './pages/painel/NovoMaterialPage';
import { EditarMaterialPage } from './pages/painel/EditarMaterialPage';
import { FavoritosPage } from './pages/painel/FavoritosPage';
import { ColecoesPage } from './pages/painel/ColecoesPage';
import { PerfilPage } from './pages/painel/PerfilPage';
import { OrganizacoesPage } from './pages/painel/OrganizacoesPage';
import { NotificacoesPage } from './pages/painel/NotificacoesPage';
import { DenunciasPage } from './pages/painel/DenunciasPage';
import { ConfiguracoesPage } from './pages/painel/ConfiguracoesPage';
import { RequireGestaoAuth } from './components/RequireGestaoAuth';
import { GestaoVisaoGeralPage } from './pages/gestao/GestaoVisaoGeralPage';
import { GestaoModeracaoPage } from './pages/gestao/GestaoModeracaoPage';
import { GestaoMateriaisPage } from './pages/gestao/GestaoMateriaisPage';
import { GestaoAuditoriaPage } from './pages/gestao/GestaoAuditoriaPage';
import { GestaoDenunciasPage } from './pages/gestao/GestaoDenunciasPage';
import { GestaoLinksPage } from './pages/gestao/GestaoLinksPage';
import { GestaoArquivosPage } from './pages/gestao/GestaoArquivosPage';
import { GestaoMidiasPage } from './pages/gestao/GestaoMidiasPage';
import { GestaoPublicadoresPage } from './pages/gestao/GestaoPublicadoresPage';
import { GestaoTaxonomiasPage } from './pages/gestao/GestaoTaxonomiasPage';
import { GestaoMetricasPage } from './pages/gestao/GestaoMetricasPage';
import { GestaoConfiguracoesPage } from './pages/gestao/GestaoConfiguracoesPage';

function AnalyticsPageviews() {
  useAnalyticsPageviews();
  return null;
}

// T4.1 (spec 073) — rotas publicas de descoberta. Painel (074) e gestao (075)
// entram em specs seguintes; /usuarios/:username aponta ao perfil comunitario
// compartilhado (fora do escopo desta spec, placeholder de redirect por ora).
function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/sobre-e-uso" element={<SobreEUsoPage />} />
      <Route path="/catalogo" element={<CatalogoPage />} />
      <Route path="/materiais/:materialSlug" element={<MaterialPage />} />
      <Route path="/criadores/:slug" element={<CreatorPage />} />
      <Route path="/ir/:destinationId" element={<RedirectDestinationPage />} />
      <Route path="/obter/:fileId" element={<ObterArquivoPage />} />

      <Route path="/painel" element={<RequireAuth><VisaoGeralPage /></RequireAuth>} />
      <Route path="/painel/materiais" element={<RequireAuth><MeusMateriaisPage /></RequireAuth>} />
      <Route path="/painel/materiais/novo" element={<RequireAuth><NovoMaterialPage /></RequireAuth>} />
      <Route path="/painel/materiais/:materialId/editar" element={<RequireAuth><EditarMaterialPage /></RequireAuth>} />
      <Route path="/painel/favoritos" element={<RequireAuth><FavoritosPage /></RequireAuth>} />
      <Route path="/painel/colecoes" element={<RequireAuth><ColecoesPage /></RequireAuth>} />
      <Route path="/painel/perfil" element={<RequireAuth><PerfilPage /></RequireAuth>} />
      <Route path="/painel/organizacoes" element={<RequireAuth><OrganizacoesPage /></RequireAuth>} />
      <Route path="/painel/notificacoes" element={<RequireAuth><NotificacoesPage /></RequireAuth>} />
      <Route path="/painel/denuncias" element={<RequireAuth><DenunciasPage /></RequireAuth>} />
      <Route path="/painel/configuracoes" element={<RequireAuth><ConfiguracoesPage /></RequireAuth>} />

      <Route path="/gestao" element={<RequireGestaoAuth><GestaoVisaoGeralPage /></RequireGestaoAuth>} />
      <Route path="/gestao/moderacao" element={<RequireGestaoAuth><GestaoModeracaoPage /></RequireGestaoAuth>} />
      <Route path="/gestao/materiais" element={<RequireGestaoAuth><GestaoMateriaisPage /></RequireGestaoAuth>} />
      <Route path="/gestao/auditoria/:materialId" element={<RequireGestaoAuth><GestaoAuditoriaPage /></RequireGestaoAuth>} />
      <Route path="/gestao/auditoria" element={<RequireGestaoAuth><GestaoAuditoriaPage /></RequireGestaoAuth>} />
      <Route path="/gestao/denuncias" element={<RequireGestaoAuth><GestaoDenunciasPage /></RequireGestaoAuth>} />
      <Route path="/gestao/links" element={<RequireGestaoAuth><GestaoLinksPage /></RequireGestaoAuth>} />
      <Route path="/gestao/arquivos" element={<RequireGestaoAuth><GestaoArquivosPage /></RequireGestaoAuth>} />
      <Route path="/gestao/midias" element={<RequireGestaoAuth><GestaoMidiasPage /></RequireGestaoAuth>} />
      <Route path="/gestao/publicadores" element={<RequireGestaoAuth><GestaoPublicadoresPage /></RequireGestaoAuth>} />
      <Route path="/gestao/taxonomias" element={<RequireGestaoAuth><GestaoTaxonomiasPage /></RequireGestaoAuth>} />
      <Route path="/gestao/metricas" element={<RequireGestaoAuth><GestaoMetricasPage /></RequireGestaoAuth>} />
      <Route path="/gestao/configuracoes" element={<RequireGestaoAuth><GestaoConfiguracoesPage /></RequireGestaoAuth>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AnalyticsPageviews />
      <AppRoutes />
      <Toaster position="top-right" />
    </BrowserRouter>
  );
}

export default App;
