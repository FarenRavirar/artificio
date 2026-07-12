import { Link } from 'react-router-dom';
import { AppShell } from '../components/AppShell';

export function HomePage() {
  return (
    <AppShell>
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="text-3xl font-bold text-white">Materiais gratuitos de RPG</h1>
        <p className="mt-3 text-white/70">
          Aventuras, fichas, mapas e mais — organizados por sistema e edição.
        </p>
        <Link
          to="/catalogo"
          className="mt-6 inline-flex min-h-[44px] items-center justify-center rounded-md bg-artificio-orange px-6 py-2 font-semibold text-white hover:bg-artificio-orange-hover"
        >
          Explorar catálogo
        </Link>
      </div>
    </AppShell>
  );
}
