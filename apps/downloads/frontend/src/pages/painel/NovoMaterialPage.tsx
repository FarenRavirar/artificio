import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { PainelShell } from '../../components/PainelShell';
import { useCreateMaterial } from '../../hooks/useCreateMaterial';
import { useMaterialTypes } from '../../hooks/useMaterialTypes';

// T2.1 (spec 082) — criacao de material pelo autor. Backend so aceita
// slug/title/material_type_id (materials.ts POST /); demais campos (resumo,
// descricao, link, editora) sao preenchidos depois em EditarMaterialPage,
// que ja cobre esses campos via PATCH.
export function NovoMaterialPage() {
  const navigate = useNavigate();
  const createMutation = useCreateMaterial();
  const materialTypesQuery = useMaterialTypes();

  const [slug, setSlug] = useState('');
  const [title, setTitle] = useState('');
  const [materialType, setMaterialType] = useState('');

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    try {
      const created = await createMutation.mutateAsync({
        slug: slug.trim(),
        title: title.trim(),
        material_type_id: materialType,
      });
      toast.success('Material criado como rascunho.');
      navigate(`/painel/materiais/${created.id}/editar`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha ao criar material.');
    }
  };

  return (
    <PainelShell>
      <h1 className="text-2xl font-bold text-[var(--fg)]">Novo material</h1>
      <p className="mt-2 text-sm text-[var(--fg-muted)]">
        Cria o rascunho. Resumo, descrição, link de destino e editora são preenchidos na tela de edição, logo em seguida.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 flex max-w-xl flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm text-[var(--fg-muted)]">
          <span>Título</span>
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="min-h-[44px] rounded-md border border-[var(--line)] bg-transparent px-3 py-2 text-[var(--fg)]"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm text-[var(--fg-muted)]">
          <span>Slug</span>
          <input
            required
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="identificador-unico-na-url"
            className="min-h-[44px] rounded-md border border-[var(--line)] bg-transparent px-3 py-2 text-[var(--fg)]"
          />
        </label>

        <div className="flex flex-col gap-1 text-sm text-[var(--fg-muted)]">
          <label htmlFor="material-type">Tipo de material</label>
          <select
            id="material-type"
            required
            value={materialType}
            onChange={(e) => setMaterialType(e.target.value)}
            disabled={materialTypesQuery.isPending || materialTypesQuery.isError}
            className="min-h-[44px] rounded-md border border-[var(--line)] bg-transparent px-3 py-2 text-[var(--fg)]"
          >
            <option value="">Selecione um tipo</option>
            {(materialTypesQuery.data ?? []).map((type) => (
              <option key={type.id} value={type.id}>{type.name}</option>
            ))}
          </select>
          {materialTypesQuery.isError && (
            <div role="alert" className="flex items-center gap-2 text-xs text-red-600">
              <span>Tipos indisponíveis.</span>
              {/* Achado real (review PR #205, Codex): mensagem sem ação deixava
                  o formulário travado após falha transitória. Refetch permite
                  recuperar sem recarregar/perder os campos preenchidos. */}
              <button
                type="button"
                onClick={() => void materialTypesQuery.refetch()}
                disabled={materialTypesQuery.isFetching}
                className="min-h-[44px] rounded-md border border-current px-3 font-semibold disabled:opacity-50"
              >
                Tentar novamente
              </button>
            </div>
          )}
        </div>

        <button
          type="submit"
          disabled={createMutation.isPending || materialTypesQuery.isPending || materialTypesQuery.isError}
          className="min-h-[44px] w-fit rounded-md bg-artificio-orange px-6 py-2 font-semibold text-white hover:bg-artificio-orange-hover disabled:opacity-50"
        >
          {createMutation.isPending ? 'Criando...' : 'Criar rascunho'}
        </button>
      </form>
    </PainelShell>
  );
}
