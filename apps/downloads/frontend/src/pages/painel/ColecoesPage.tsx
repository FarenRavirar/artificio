import { useState, type FormEvent } from 'react';
import toast from 'react-hot-toast';
import { PainelShell } from '../../components/PainelShell';
import { useCollections, useCreateCollection } from '../../hooks/useCollections';

export function ColecoesPage() {
  const { data: collections, isLoading } = useCollections();
  const createMutation = useCreateCollection();
  const [title, setTitle] = useState('');

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim()) return;
    const slug = title.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    try {
      await createMutation.mutateAsync({ slug, title: title.trim() });
      setTitle('');
      toast.success('Coleção criada.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha ao criar coleção.');
    }
  };

  return (
    <PainelShell>
      <h1 className="text-2xl font-bold text-[var(--fg)]">Coleções</h1>

      <form onSubmit={handleCreate} className="mt-4 flex gap-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Nome da coleção"
          className="min-h-[44px] flex-1 rounded-md border border-[var(--line)] bg-transparent px-3 py-2 text-[var(--fg)]"
        />
        <button
          type="submit"
          disabled={createMutation.isPending}
          className="min-h-[44px] rounded-md bg-artificio-orange px-4 py-2 font-semibold text-white disabled:opacity-50"
        >
          Criar
        </button>
      </form>

      {isLoading && <p className="mt-4 text-[var(--fg-muted)]">Carregando...</p>}
      {collections?.length === 0 && <p className="mt-4 text-[var(--fg-muted)]">Nenhuma coleção ainda.</p>}

      <ul className="mt-6 divide-y divide-[var(--line)]">
        {collections?.map((collection) => (
          <li key={collection.id} className="py-3">
            <p className="font-semibold text-[var(--fg)]">{collection.title}</p>
            <p className="text-xs text-[var(--fg-muted)]">{collection.is_public ? 'Pública' : 'Privada'}</p>
          </li>
        ))}
      </ul>
    </PainelShell>
  );
}
