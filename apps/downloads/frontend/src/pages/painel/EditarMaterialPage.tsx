import { useState, type FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { PainelShell } from '../../components/PainelShell';
import { useMyMaterials } from '../../hooks/useMyMaterials';
import { useUpdateMaterial } from '../../hooks/useUpdateMaterial';
import { useSubmitMaterial } from '../../hooks/useSubmitMaterial';
import { useMaterialHistory } from '../../hooks/useMaterialHistory';
import { useMaterialMetadata } from '../../hooks/useMaterialMetadata';
import { useUpdateMaterialMetadata } from '../../hooks/useUpdateMaterialMetadata';

const FIELD_LABEL: Record<string, string> = {
  title: 'Título',
  summary: 'Resumo',
  description: 'Descrição',
  external_url: 'Link de destino',
};

// T2.1/T2.2/T2.3 (spec 074) — edicao reaproveitando o mesmo PATCH de
// submissao (spec 070/072), incluindo link de destino; historico por campo
// exibido abaixo do formulario (criterio de aceite 1, 2, 3).
export function EditarMaterialPage() {
  const { materialId } = useParams<{ materialId: string }>();
  const { data: materials, isLoading } = useMyMaterials();
  const material = materials?.find((m) => m.id === materialId);
  const updateMutation = useUpdateMaterial(materialId ?? '');
  const submitMutation = useSubmitMaterial(materialId ?? '');
  const { data: history } = useMaterialHistory(materialId);
  const { data: metadata } = useMaterialMetadata(materialId);
  const updateMetadataMutation = useUpdateMaterialMetadata(materialId ?? '');

  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [description, setDescription] = useState('');
  const [externalUrl, setExternalUrl] = useState('');
  const [publisherName, setPublisherName] = useState('');
  const [lastLoadedMaterialId, setLastLoadedMaterialId] = useState<string | undefined>(undefined);
  const [lastLoadedMetadataMaterialId, setLastLoadedMetadataMaterialId] = useState<string | undefined>(undefined);

  // Reajusta os campos durante o render quando o material carrega ou muda —
  // padrao React de "ajustar estado durante o render" (sem effect), mesmo
  // usado em CatalogoPage.tsx (spec 073) para nao acionar
  // react-hooks/set-state-in-effect.
  if (material && lastLoadedMaterialId !== material.id) {
    setLastLoadedMaterialId(material.id);
    setTitle(material.title);
    setSummary(material.summary ?? '');
    setDescription(material.description ?? '');
    setExternalUrl(material.external_url ?? '');
  }

  // Metadata chega depois do material (query separada); preenche
  // publisherName quando resolver, sem sobrescrever com vazio no meio tempo
  // (mesmo padrao de ajuste durante o render usado acima, evita
  // react-hooks/set-state-in-effect).
  if (metadata && lastLoadedMetadataMaterialId !== materialId) {
    setLastLoadedMetadataMaterialId(materialId);
    setPublisherName(metadata.publisher_name ?? '');
  }

  if (isLoading) {
    return (
      <PainelShell>
        <p className="text-[var(--fg-muted)]">Carregando...</p>
      </PainelShell>
    );
  }

  if (!material) {
    return (
      <PainelShell>
        <p className="text-[var(--fg-muted)]">Material não encontrado ou não pertence à sua conta.</p>
      </PainelShell>
    );
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    try {
      await updateMutation.mutateAsync({
        title,
        summary: summary || null,
        description: description || null,
        external_url: externalUrl || null,
      });
      await updateMetadataMutation.mutateAsync({ publisher_name: publisherName || null });
      toast.success('Material atualizado.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha ao salvar.');
    }
  };

  const canSubmitForReview = material.editorial_state === 'draft' || material.editorial_state === 'rejected';

  const handleSubmitForReview = async () => {
    try {
      await submitMutation.mutateAsync();
      toast.success('Material enviado para revisão.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha ao enviar para revisão.');
    }
  };

  return (
    <PainelShell>
      <h1 className="text-2xl font-bold text-[var(--fg)]">Editar material</h1>

      <form onSubmit={handleSubmit} className="mt-6 flex max-w-xl flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm text-[var(--fg-muted)]">
          <span>Título</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="min-h-[44px] rounded-md border border-[var(--line)] bg-transparent px-3 py-2 text-[var(--fg)]"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm text-[var(--fg-muted)]">
          <span>Resumo</span>
          <textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            className="rounded-md border border-[var(--line)] bg-transparent px-3 py-2 text-[var(--fg)]"
            rows={2}
          />
        </label>

        <label className="flex flex-col gap-1 text-sm text-[var(--fg-muted)]">
          <span>Descrição</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="rounded-md border border-[var(--line)] bg-transparent px-3 py-2 text-[var(--fg)]"
            rows={5}
          />
        </label>

        <label className="flex flex-col gap-1 text-sm text-[var(--fg-muted)]">
          <span>Link de destino</span>
          <input
            value={externalUrl}
            onChange={(e) => setExternalUrl(e.target.value)}
            className="min-h-[44px] rounded-md border border-[var(--line)] bg-transparent px-3 py-2 text-[var(--fg)]"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm text-[var(--fg-muted)]">
          <span>Editora/selo</span>
          <input
            value={publisherName}
            onChange={(e) => setPublisherName(e.target.value)}
            placeholder="Nome da editora ou selo (opcional)"
            className="min-h-[44px] rounded-md border border-[var(--line)] bg-transparent px-3 py-2 text-[var(--fg)]"
          />
        </label>

        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={updateMutation.isPending}
            className="min-h-[44px] w-fit rounded-md bg-artificio-orange px-6 py-2 font-semibold text-white hover:bg-artificio-orange-hover disabled:opacity-50"
          >
            {updateMutation.isPending ? 'Salvando...' : 'Salvar'}
          </button>

          {canSubmitForReview && (
            <button
              type="button"
              onClick={handleSubmitForReview}
              disabled={submitMutation.isPending}
              className="min-h-[44px] w-fit rounded-md border border-[var(--line)] px-6 py-2 font-semibold text-[var(--fg)] hover:border-artificio-orange disabled:opacity-50"
            >
              {submitMutation.isPending ? 'Enviando...' : 'Enviar para revisão'}
            </button>
          )}
        </div>
      </form>

      <h2 className="mt-10 text-lg font-semibold text-[var(--fg)]">Histórico de edição</h2>
      {history && history.length === 0 && <p className="mt-2 text-[var(--fg-muted)]">Nenhuma edição registrada ainda.</p>}
      <ul className="mt-4 space-y-2 text-sm text-[var(--fg-muted)]">
        {history?.map((entry) => (
          <li key={entry.id} className="rounded-md border border-[var(--line)] px-3 py-2">
            <span className="font-semibold text-[var(--fg)]">{FIELD_LABEL[entry.field_name] ?? entry.field_name}</span>{' '}
            alterado em {new Date(entry.changed_at).toLocaleString('pt-BR')}
            <div className="mt-1 text-xs text-[var(--fg-muted)]">
              De: {entry.old_value ?? '(vazio)'} → Para: {entry.new_value ?? '(vazio)'}
            </div>
          </li>
        ))}
      </ul>
    </PainelShell>
  );
}
