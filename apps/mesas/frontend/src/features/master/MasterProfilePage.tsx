import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Compass } from 'lucide-react';
import type { MasterResponse } from './types/masterView.types';
import { useMasterViewModel } from './hooks/useMasterViewModel';
import { MasterHero } from './components/MasterHero';
import { MasterActions } from './components/MasterActions';
import { MasterStats } from './components/MasterStats';
import { MasterBio } from './components/MasterBio';
import { MasterTables } from './components/MasterTables';

/**
 * Página de perfil público do mestre
 * 
 * Estrutura:
 * 1. Hero (identidade + confiança)
 * 2. Actions (owner only)
 * 3. Stats (prova social)
 * 4. Bio (apresentação)
 * 5. Tables (portfólio - REUSA componentes)
 */
export function MasterProfilePage() {
  const { masterId } = useParams<{ masterId: string }>();
  const [master, setMaster] = useState<MasterResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // TODO: Pegar do auth context
  const currentUserId = undefined;
  
  const vm = useMasterViewModel(master, currentUserId);

  useEffect(() => {
    const loadMaster = async () => {
      if (!masterId) {
        setError('ID do mestre inválido.');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const res = await fetch(`/api/v1/masters/${masterId}`);
        
        if (res.status === 404) {
          setError('Mestre não encontrado.');
          setMaster(null);
          setLoading(false);
          return;
        }

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const json = await res.json();
        setMaster(json.data ?? null);
      } catch {
        setError('Não foi possível carregar o perfil do mestre.');
      } finally {
        setLoading(false);
      }
    };

    loadMaster();
  }, [masterId]);

  if (loading) {
    return (
      <main className="min-h-screen bg-[var(--color-artificio-blue)] text-white flex items-center justify-center">
        <p className="animate-pulse text-white/70">Carregando perfil...</p>
      </main>
    );
  }

  if (error || !vm) {
    return (
      <main className="min-h-screen bg-[var(--color-artificio-blue)] text-white flex items-center justify-center px-6">
        <div className="max-w-lg w-full rounded-2xl border border-white/10 bg-white/5 p-6 text-center">
          <h1 className="text-2xl font-bold mb-2">Ops!</h1>
          <p className="text-white/70 mb-5">{error ?? 'Mestre não encontrado.'}</p>
          <Link
            to="/catalogo"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--color-artificio-orange)] hover:bg-[var(--color-artificio-orange-hover)] transition-colors"
          >
            <Compass className="w-4 h-4" /> Voltar ao catálogo
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--color-artificio-blue)] text-white pb-16">
      <div className="container mx-auto px-6 py-8 space-y-6">
        
        {/* 1. Hero */}
        <MasterHero vm={vm} />
        
        {/* 2. CTA para visitantes */}
        {!vm.isOwner && vm.tables.length > 0 && (
          <div className="text-center">
            <button
              onClick={() => {
                document.getElementById('mesas-section')?.scrollIntoView({ 
                  behavior: 'smooth',
                  block: 'start'
                });
              }}
              className="px-6 py-3 rounded-lg bg-[var(--color-artificio-orange)] hover:bg-[var(--color-artificio-orange-hover)] transition-colors font-semibold text-lg"
            >
              Ver mesas disponíveis
            </button>
          </div>
        )}
        
        {/* 3. Actions (owner only) */}
        <MasterActions vm={vm} />
        
        {/* 4. Stats (prova social) */}
        <MasterStats vm={vm} />
        
        {/* 5. Bio */}
        <MasterBio vm={vm} />
        
        {/* 6. Mesas (principal conteúdo) */}
        <MasterTables vm={vm} />
        
      </div>
    </main>
  );
}
