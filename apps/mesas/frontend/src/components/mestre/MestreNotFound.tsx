import { Link } from 'react-router-dom';

export function MestreNotFound() {
  return (
    <main className="min-h-screen bg-[var(--color-artificio-blue)] text-[var(--fg)] flex items-center justify-center px-6">
      <div className="max-w-lg w-full rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--fill-5)] p-6 text-center">
        <h1 className="text-[length:var(--text-title)] leading-[var(--leading-title)] font-[var(--weight-strong)] mb-2">Perfil indisponível</h1>
        <p className="text-[var(--fg-soft)] mb-5">Mestre não encontrado.</p>
        <Link
          to="/catalogo"
          id="mestre-link-catalogo"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-[var(--radius-md)] bg-[var(--color-artificio-orange)] hover:bg-[var(--color-artificio-orange-hover)] transition-colors"
        >
          Voltar ao catálogo
        </Link>
      </div>
    </main>
  );
}
