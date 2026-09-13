import { useEffect, useState } from 'react';
import { Links, Meta, Outlet, Scripts, ScrollRestoration, isRouteErrorResponse, useRouteError } from 'react-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { ConfirmProvider } from '@artificio/ui';
import { useAnalyticsPageviews } from '@artificio/analytics/react';
import { queryClient } from './lib/queryClient';
import { AuthProvider } from './contexts/AuthContext';
import { AppShell } from './components/AppShell';
import { BackendStatusScreen } from './components/BackendStatusScreen';
import '@artificio/ui/styles.css';
import '@artificio/comments/styles.css';
import './index.css';

function AnalyticsPageviews() {
  useAnalyticsPageviews();
  return null;
}

/**
 * `meta` default do documento (spec 102 T4.2).
 *
 * Existe porque o `index.html` estático dava `<title>` e `description` a TODAS
 * as rotas, e no framework mode só herda quem não define o seu. Medido antes de
 * remover o `index.html`: `/login` e `/jogador/:username` saíam **sem `<title>`
 * nenhum** — aba sem nome para o visitante, e resultado sem título para o
 * crawler numa rota pública e indexável.
 *
 * As rotas que têm identidade própria (`catalogo`, `mesa`, `mestre`) continuam
 * sobrescrevendo isto; o default só cobre quem não se descreve.
 */
export function meta() {
  return [
    { title: 'Artifício Mesas — Encontre sua próxima aventura de RPG' },
    {
      name: 'description',
      content:
        'Plataforma gratuita para encontrar mesas de RPG. Descubra mestres e aventuras de D&D, Pathfinder e outros sistemas.',
    },
  ];
}

/**
 * Documento HTML servido pelo SSR (spec 102 T4.2).
 *
 * Substitui o `index.html` estático do Vite: no framework mode é este componente
 * que produz o `<html>` inteiro, e é aqui que `<Meta>`/`<Links>` injetam o que
 * antes o backend costurava em `og.ts` por regex no HTML já buildado.
 */
export function Layout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <Meta />
        <Links />
        {/* Tema lua/sol sem flash (Spec 020 D067). COMPARTILHADO: honra o cookie
            único `artificio_theme` (escolha do usuário em qualquer módulo). Sem
            cookie → dark (default operacional do mesas; ignora OS-prefers).

            Continua inline no `<head>` de propósito: precisa rodar ANTES da
            primeira pintura, senão a página pisca no tema errado. Ler o cookie
            aqui é seguro no SSR porque é string para o browser executar, não
            código que o servidor avalia. */}
        <script
          dangerouslySetInnerHTML={{
            // `\\s` e não `\s`: em template string o `\s` colapsa para `s`
            // literal, e a regex chegava ao browser como `(?:^|;s*)` — que não
            // casa `; artificio_theme=…`, a forma como o próprio browser
            // serializa cookie depois do primeiro. Quem tivesse qualquer outro
            // cookie antes deste caía no default e via o tema piscar.
            __html: `(function(){try{var m=document.cookie.match(/(?:^|;\\s*)artificio_theme=(dark|light)/);document.documentElement.dataset.theme=m?m[1]:'dark';}catch(e){document.documentElement.dataset.theme='dark';}})();`,
          }}
        />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

/**
 * Aviso de indisponibilidade do backend (DT-012), agora como overlay.
 *
 * Em `App.tsx` isto BLOQUEAVA o render até o `/health` responder. Sob SSR o
 * efeito não roda no servidor, então todo request renderizaria a tela de espera
 * — era isso que o crawler receberia no lugar da mesa. Aqui a aplicação
 * renderiza sempre e a tela só cobre a página quando o health-check de fato
 * falhou, preservando o aviso que o visitante precisa durante um deploy.
 */
function BackendHealthGate() {
  const [healthy, setHealthy] = useState<boolean | null>(null);

  useEffect(() => {
    const check = async () => {
      try {
        const apiUrl = import.meta.env.VITE_API_URL || '';
        const response = await fetch(`${apiUrl}/health`, {
          method: 'GET',
          signal: AbortSignal.timeout(5000),
        });
        setHealthy(response.ok);
      } catch {
        setHealthy(false);
      }
    };
    check();
  }, []);

  if (healthy !== false) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999 }}>
      <BackendStatusScreen status="unavailable" />
    </div>
  );
}

export default function Root() {
  return (
    <QueryClientProvider client={queryClient}>
      <AnalyticsPageviews />
      <BackendHealthGate />
      <AuthProvider>
        <ConfirmProvider>
          <AppShell>
            <Outlet />
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
    </QueryClientProvider>
  );
}

/**
 * Tela de erro das rotas (spec 102 T4.2).
 *
 * Os `loader` das rotas públicas lançam `404`/`410`/`5xx` em vez de responder
 * `200` com texto de erro — o `200` com "Mesa não encontrada" era o soft-404
 * que originou esta spec (47 das 88 URLs do sitemap). O status é o que tira a
 * URL do índice; esta tela é só o que o humano vê enquanto isso acontece.
 *
 * Por isso ela também oferece o caminho de volta ao catálogo: página sem saída
 * é beco para o visitante e para o crawler, que não encontra link nenhum a
 * seguir a partir dela.
 */
export function ErrorBoundary() {
  const error = useRouteError();
  const status = isRouteErrorResponse(error) ? error.status : 500;

  // A mensagem que o `loader` lançou (`data({ message }, { status })`) é mais
  // específica que qualquer texto genérico daqui — "Mesa encerrada" e "Mesa não
  // encontrada" são coisas diferentes para quem chegou pelo link antigo.
  const message =
    isRouteErrorResponse(error) &&
    error.data &&
    typeof error.data === 'object' &&
    'message' in error.data &&
    typeof (error.data as { message: unknown }).message === 'string'
      ? (error.data as { message: string }).message
      : null;

  let title: string;
  if (status === 404) {
    title = 'Página não encontrada';
  } else if (status === 410) {
    title = 'Página encerrada';
  } else {
    title = 'Algo deu errado';
  }

  let fallback: string;
  if (status === 404) {
    fallback = 'O endereço acessado não existe ou foi removido.';
  } else if (status === 410) {
    fallback = 'Este conteúdo foi encerrado e não está mais disponível.';
  } else {
    fallback = 'Tente novamente em instantes.';
  }

  return (
    <main style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', backgroundColor: 'var(--surface)', color: 'var(--fg)' }}>
      <div style={{ textAlign: 'center', maxWidth: '500px', padding: '32px' }}>
        <h1 style={{ fontSize: '24px', marginBottom: '16px' }}>{title}</h1>
        <p style={{ fontSize: '14px', opacity: 0.7, marginBottom: '24px' }}>{message ?? fallback}</p>
        <a
          href="/catalogo"
          style={{ display: 'inline-block', padding: '12px 24px', borderRadius: '8px', backgroundColor: 'var(--color-artificio-orange)', color: 'white', textDecoration: 'none' }}
        >
          Ver mesas abertas
        </a>
      </div>
    </main>
  );
}
