import { type RouteConfig, index, route } from '@react-router/dev/routes';

// Árvore de rotas do framework mode (spec 102 T4.2) — espelha o que vivia em
// `<Routes>` dentro de `App.tsx`. O framework precisa conhecer as rotas em
// build para saber o que renderizar no servidor; `<Routes>` só existe depois
// que o React montou, o que é tarde demais para o HTML que o crawler recebe.
//
// `root.tsx` é o layout raiz implícito e carrega os providers que antes ficavam
// em `App.tsx` (QueryClient, Auth, Confirm, AppShell).
export default [
  index('routes/catalogo.tsx'),
  route('login', 'routes/login.tsx'),
  // `/` e `/catalogo` servem a MESMA página. O `id` explícito é o que permite
  // apontar duas rotas para um módulo só — sem ele o framework recusa a
  // duplicata e obrigaria a um arquivo-cópia.
  route('catalogo', 'routes/catalogo.tsx', { id: 'catalogo-alias' }),
  route('busca', 'routes/busca.tsx'),

  // Rotas públicas indexáveis — o motivo desta task existir.
  route('mesas/:slug', 'routes/mesa.tsx'),
  route('mestre/:slug', 'routes/mestre.tsx'),
  route('jogador/:username', 'routes/jogador.tsx'),
  route('mestres/:masterId', 'routes/master-profile.tsx'),

  // Autenticadas: entram no SSR junto porque `ssr` é app-level; cada uma
  // resolve sessão no cliente (`ProtectedRoute`), não no render do servidor.
  route('onboarding', 'routes/onboarding.tsx'),
  route('perfil', 'routes/perfil.tsx'),
  route('perfil/minhas-sugestoes/:suggestionId?', 'routes/minhas-sugestoes.tsx'),
  route('painel', 'routes/painel.tsx'),

  route('gestao', 'routes/gestao.tsx', [
    index('routes/gestao.index.tsx'),
    route('visao-geral', 'routes/gestao.visao-geral.tsx'),
    route('mesas/:sub?', 'routes/gestao.mesas.tsx'),
    route('catalogo', 'routes/gestao.catalogo.tsx'),
    route('comunidade', 'routes/gestao.comunidade.tsx'),
    route('importacao', 'routes/gestao.importacao.tsx'),
    route('sistema', 'routes/gestao.sistema.tsx'),
    // Redirects das rotas antigas — sem link morto.
    route('dashboard', 'routes/gestao.dashboard.tsx'),
    route('conteudo', 'routes/gestao.conteudo.tsx'),
    route('moderacao/:sub?', 'routes/gestao.moderacao.tsx'),
    route('integracoes', 'routes/gestao.integracoes.tsx'),
  ]),
] satisfies RouteConfig;
