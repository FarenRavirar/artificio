import { useState } from 'react';
import toast from 'react-hot-toast';
import { GestaoShell } from '../../components/GestaoShell';
import { useAdminMedia, useMigrateCover, useUpdateCoverImage } from '../../hooks/useAdminMedia';
import { useCoverCapabilities } from '../../hooks/useUploadMaterialCover';

const STATE_LABEL: Record<string, string> = {
  draft: 'Rascunho',
  in_review: 'Em revisão',
  published: 'Publicado',
  rejected: 'Rejeitado',
  withdrawn: 'Retirado',
};

// T2.7 (spec 082) — MVP de Gestao de Midias: URL de capa (texto), sem
// upload/storage novo (coerente com T2.3, MVP somente-link-externo). Upload
// real via Cloudinary fica como task futura (ver tasks.md T2.7).
export function GestaoMidiasPage() {
  const { data, isLoading, isError, error, refetch } = useAdminMedia();
  const updateCover = useUpdateCoverImage();
  const migrateCover = useMigrateCover();
  const capabilities = useCoverCapabilities();
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [batchProgress, setBatchProgress] = useState<string[]>([]);
  const [batchRunning, setBatchRunning] = useState(false);
  const migrationCandidates = data?.items.filter((item) => item.editorial_state === 'published'
    && item.cover_image_url && item.cover_storage_provider !== 'cloudinary') ?? [];

  const handleSave = async (materialId: string) => {
    const value = drafts[materialId];
    if (value === undefined) return;
    try {
      await updateCover.mutateAsync({ materialId, coverImageUrl: value });
      toast.success('Capa atualizada.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha ao salvar capa.');
    }
  };

  const handleBatch = async () => {
    setBatchRunning(true);
    setBatchProgress([]);
    for (const item of migrationCandidates) {
      try {
        await migrateCover.mutateAsync(item.material_id);
        setBatchProgress((current) => [...current, `${item.material_title}: migrada`]);
      } catch (error) {
        setBatchProgress((current) => [...current, `${item.material_title}: ${error instanceof Error ? error.message : 'falhou'}`]);
      }
    }
    setBatchRunning(false);
  };

  return (
    <GestaoShell>
      <h1 className="text-2xl font-bold text-[var(--fg)]">Mídias</h1>
      <p className="mt-2 text-sm text-[var(--fg-muted)]">
        Cole uma URL de capa. Enquanto a cópia para o Cloudinary estiver desligada, o endereço externo é preservado.
      </p>
      <button
        type="button"
        onClick={() => void handleBatch()}
        disabled={!capabilities.data?.cloudinary_enabled || batchRunning}
        className="mt-4 min-h-[44px] rounded-md border border-[var(--line)] px-4 py-2 font-semibold text-[var(--fg)] disabled:opacity-50"
      >
        {batchRunning ? 'Migrando capas...' : 'Migrar capas publicadas'}
      </button>
      {!capabilities.data?.cloudinary_enabled && <p className="mt-2 text-xs text-[var(--fg-muted)]">Migração desligada por configuração.</p>}
      <p className="mt-2 text-xs text-[var(--fg-muted)]">
        {migrationCandidates.length} capa(s) publicada(s) pendente(s); armazenamento máximo estimado: {migrationCandidates.length * 5} MB; nenhuma transformação explícita.
      </p>
      {batchProgress.length > 0 && (
        <ul className="mt-3 text-xs text-[var(--fg-muted)]">
          {batchProgress.map((result) => <li key={result}>{result}</li>)}
        </ul>
      )}

      {isLoading && <p className="mt-4 text-[var(--fg-muted)]">Carregando...</p>}
      {isError && (
        <div className="mt-4 flex items-center gap-3">
          <p className="text-sm text-red-400">{error instanceof Error ? error.message : 'Falha ao carregar mídias.'}</p>
          <button
            type="button"
            onClick={() => refetch()}
            className="rounded-md border border-[var(--line)] px-3 py-1 text-sm text-[var(--fg)]"
          >
            Tentar novamente
          </button>
        </div>
      )}
      {data?.items.length === 0 && <p className="mt-4 text-[var(--fg-muted)]">Nenhum material cadastrado ainda.</p>}

      <ul className="mt-6 divide-y divide-[var(--line)]">
        {data?.items.map((item) => (
          <li key={item.material_id} className="flex flex-wrap items-center gap-3 py-3">
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-[var(--fg)]">{item.material_title}</p>
              <p className="text-xs text-[var(--fg-muted)]">
                {STATE_LABEL[item.editorial_state] ?? item.editorial_state}
              </p>
            </div>
            <input
              type="url"
              value={drafts[item.material_id] ?? item.cover_image_url ?? ''}
              onChange={(e) => setDrafts((prev) => ({ ...prev, [item.material_id]: e.target.value }))}
              placeholder="https://…"
              className="min-h-[44px] min-w-[220px] flex-1 rounded-md border border-[var(--line)] bg-transparent px-3 py-2 text-sm text-[var(--fg)]"
            />
            <button
              type="button"
              onClick={() => handleSave(item.material_id)}
              disabled={updateCover.isPending}
              className="min-h-[44px] rounded-md border border-[var(--line)] px-4 py-2 text-sm text-[var(--fg)] hover:border-artificio-orange disabled:opacity-50"
            >
              Salvar
            </button>
          </li>
        ))}
      </ul>
    </GestaoShell>
  );
}
