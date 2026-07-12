import { useState, type FormEvent } from 'react';
import toast from 'react-hot-toast';
import { PainelShell } from '../../components/PainelShell';
import { useCreateOrganization, useOrganizations } from '../../hooks/useOrganizations';

export function OrganizacoesPage() {
  const { data: organizations, isLoading } = useOrganizations();
  const createMutation = useCreateOrganization();
  const [name, setName] = useState('');

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    try {
      await createMutation.mutateAsync({ slug, name: name.trim() });
      setName('');
      toast.success('Organização criada.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha ao criar organização.');
    }
  };

  return (
    <PainelShell>
      <h1 className="text-2xl font-bold text-white">Organizações</h1>

      <form onSubmit={handleCreate} className="mt-4 flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nome da organização"
          className="min-h-[44px] flex-1 rounded-md border border-white/20 bg-transparent px-3 py-2 text-white"
        />
        <button
          type="submit"
          disabled={createMutation.isPending}
          className="min-h-[44px] rounded-md bg-artificio-orange px-4 py-2 font-semibold text-white disabled:opacity-50"
        >
          Criar
        </button>
      </form>

      {isLoading && <p className="mt-4 text-white/60">Carregando...</p>}
      {organizations?.length === 0 && <p className="mt-4 text-white/60">Você não participa de nenhuma organização.</p>}

      <ul className="mt-6 divide-y divide-white/10">
        {organizations?.map((org) => (
          <li key={org.id} className="py-3">
            <p className="font-semibold text-white">{org.name}</p>
            <p className="text-xs text-white/60">{org.role === 'admin' ? 'Administrador' : 'Membro'}</p>
          </li>
        ))}
      </ul>
    </PainelShell>
  );
}
