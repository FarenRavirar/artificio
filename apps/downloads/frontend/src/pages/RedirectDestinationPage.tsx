import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { useDestination } from '../hooks/useDestination';

// T4.1 (spec 073) — /ir/:destinationId: fail-closed. So redireciona quando o
// destino opaco (download_destination, DEB-073-02) resolve para uma URL real
// de material publicado; qualquer outro caso mostra aviso em vez de
// redirecionar as cegas.
export function RedirectDestinationPage() {
  const { destinationId } = useParams<{ destinationId: string }>();
  const { data: externalUrl, isLoading, isError } = useDestination(destinationId);

  useEffect(() => {
    if (externalUrl) {
      window.location.replace(externalUrl);
    }
  }, [externalUrl]);

  if (isLoading) {
    return (
      <AppShell>
        <div className="mx-auto max-w-2xl px-4 py-16 text-center text-white/70">Redirecionando...</div>
      </AppShell>
    );
  }

  if (isError || !externalUrl) {
    return (
      <AppShell>
        <div className="mx-auto max-w-2xl px-4 py-16 text-center">
          <h1 className="text-2xl font-bold text-white">Destino indisponível</h1>
          <p className="mt-2 text-white/70">Não foi possível confirmar o link de acesso deste material.</p>
        </div>
      </AppShell>
    );
  }

  return null;
}
