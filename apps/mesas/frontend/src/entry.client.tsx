import { StrictMode, startTransition } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { HydratedRouter } from 'react-router/dom';
import { installDiagnostics } from './lib/diagnostics';
import { applyFavicon } from '@artificio/ui';
import { initGtag } from '@artificio/analytics';

// Só-browser, e por isso vive no entry do CLIENTE (spec 102 T4.2). Estava em
// `main.tsx`, no corpo do módulo: rodava na importação e quebraria no servidor,
// onde `document` não existe.
installDiagnostics();
applyFavicon();

const gaId = import.meta.env.VITE_GA_ID;
if (gaId) {
  initGtag(gaId);
}

// Tema lua/sol (Spec 020 D067). O script inline do `root.tsx` já resolveu isto
// antes da primeira pintura; repetir aqui mantém o dataset correto se o cookie
// mudar durante a sessão, sem piscar.
function resolveMesasTheme(): 'light' | 'dark' {
  const m = document.cookie.match(/(?:^|;\s*)artificio_theme=(dark|light)/);
  return m ? (m[1] as 'light' | 'dark') : 'dark';
}
document.documentElement.dataset.theme = resolveMesasTheme();

startTransition(() => {
  hydrateRoot(
    document,
    <StrictMode>
      <HydratedRouter />
    </StrictMode>,
  );
});
