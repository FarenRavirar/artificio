import { Link } from 'react-router-dom';

interface MestreErrorProps {
  message: string;
}

export function MestreError({ message }: MestreErrorProps) {
  return (
    <main className="min-h-screen bg-[var(--color-artificio-blue)] text-white flex items-center justify-center px-6">
      <div className="max-w-lg w-full rounded-2xl border border-white/10 bg-white/5 p-6 text-center">
        <h1 className="text-2xl font-bold mb-2">Perfil indisponível</h1>
        <p className="text-white/70 mb-5">{message}</p>
        <Link
          to="/catalogo"
          id="mestre-link-catalogo"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--color-artificio-orange)] hover:bg-[var(--color-artificio-orange-hover)] transition-colors"
        >
          Voltar ao catálogo
        </Link>
      </div>
    </main>
  );
}
