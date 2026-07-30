import { useState, type FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ContentEditor } from '@artificio/content-editor';
import { Select } from '@artificio/ui';
import { PainelShell } from '../../components/PainelShell';
import { useMyMaterials } from '../../hooks/useMyMaterials';
import { useUpdateMaterial } from '../../hooks/useUpdateMaterial';
import { useSubmitMaterial } from '../../hooks/useSubmitMaterial';
import { useMaterialHistory } from '../../hooks/useMaterialHistory';
import { useUpdateMaterialMetadata } from '../../hooks/useUpdateMaterialMetadata';
import { useCatalogSystems, type CatalogSystem } from '../../hooks/useCatalogSystems';
import { useCoverCapabilities, useImportMaterialCoverUrl, useUploadMaterialCover } from '../../hooks/useUploadMaterialCover';

const FIELD_LABEL: Record<string, string> = {
  title: 'Título',
  summary: 'Resumo',
  description: 'Descrição',
  external_url: 'Link de destino',
  system_id: 'Sistema',
  edition_id: 'Edição',
};

function belongsToSystem(
  node: CatalogSystem,
  systemId: string,
  byId: ReadonlyMap<string, CatalogSystem>,
): boolean {
  const visited = new Set<string>();
  let parentId = node.parent_id;
  while (parentId && !visited.has(parentId)) {
    if (parentId === systemId) return true;
    visited.add(parentId);
    parentId = byId.get(parentId)?.parent_id ?? null;
  }
  return false;
}

function splitCreditNames(value: string): string[] {
  return value.split(',').map((item) => item.trim()).filter(Boolean);
}

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
  const updateMetadataMutation = useUpdateMaterialMetadata(materialId ?? '');
  const catalogSystemsQuery = useCatalogSystems();
  const uploadCoverMutation = useUploadMaterialCover(materialId ?? '');
  const importCoverUrlMutation = useImportMaterialCoverUrl(materialId ?? '');
  const coverCapabilities = useCoverCapabilities();

  const [title, setTitle] = useState('');
  const [descriptionMarkdown, setDescriptionMarkdown] = useState('');
  const [externalUrl, setExternalUrl] = useState('');
  const [publisherName, setPublisherName] = useState('');
  const [authors, setAuthors] = useState('');
  const [artists, setArtists] = useState('');
  const [systemId, setSystemId] = useState('');
  const [editionId, setEditionId] = useState('');
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverUrl, setCoverUrl] = useState('');
  const [lastLoadedMaterialId, setLastLoadedMaterialId] = useState<string | undefined>(undefined);

  // Reajusta os campos durante o render quando o material carrega ou muda —
  // padrao React de "ajustar estado durante o render" (sem effect), mesmo
  // usado em CatalogoPage.tsx (spec 073) para nao acionar
  // react-hooks/set-state-in-effect.
  if (material && lastLoadedMaterialId !== material.id) {
    setLastLoadedMaterialId(material.id);
    setTitle(material.title);
    setDescriptionMarkdown(material.description_markdown ?? material.description ?? '');
    setExternalUrl(material.external_url ?? '');
    setPublisherName(material.publisher_name ?? '');
    setAuthors((material.authors ?? []).join(', '));
    setArtists((material.artists ?? []).join(', '));
    setSystemId(material.system_id ?? '');
    setEditionId(material.edition_id ?? '');
    setCoverUrl(material.cover_image_url ?? '');
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
      const taxonomyChanged = systemId !== (material.system_id ?? '')
        || editionId !== (material.edition_id ?? '');
      await updateMutation.mutateAsync({
        title,
        external_url: externalUrl || null,
        ...(taxonomyChanged ? {
          system_id: systemId || null,
          edition_id: editionId || null,
        } : {}),
      });
      await updateMetadataMutation.mutateAsync({
        publisher_name: publisherName || null,
        description_markdown: descriptionMarkdown.trim() || null,
        authors: splitCreditNames(authors),
        artists: splitCreditNames(artists),
      });
      toast.success('Material atualizado.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha ao salvar.');
    }
  };

  const canSubmitForReview = material.editorial_state === 'draft' || material.editorial_state === 'rejected';
  const catalogNodes = catalogSystemsQuery.data ?? [];
  const catalogById = new Map(catalogNodes.map((node) => [node.id, node]));
  const systemOptions = catalogNodes.filter((node) => node.node_type === 'system');
  const editionOptions = systemId
    ? catalogNodes.filter((node) => node.node_type !== 'system' && belongsToSystem(node, systemId, catalogById))
    : [];
  const persistedDescription = material.description_markdown ?? material.description ?? '';
  const taskItems = [
    { label: 'Básico: título e tipo', done: Boolean(material.title && material.material_type_id) },
    { label: 'Descrição e créditos', done: Boolean(persistedDescription.trim() && (material.authors?.length ?? 0) > 0) },
    { label: 'Sistema', done: Boolean(material.system_id) },
    { label: 'Capa', done: Boolean(material.cover_image_url) },
    { label: 'Destino', done: Boolean(material.external_url) },
    { label: 'Prévia do conteúdo', done: Boolean(persistedDescription.trim()) },
    { label: 'Enviar para revisão', done: !canSubmitForReview },
  ];

  const handleSubmitForReview = async () => {
    try {
      await submitMutation.mutateAsync();
      toast.success('Material enviado para revisão.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha ao enviar para revisão.');
    }
  };

  const handleCoverUpload = async () => {
    if (!coverFile) return;
    if (coverFile.size > 5 * 1024 * 1024) {
      toast.error('A capa deve ter no máximo 5 MB.');
      return;
    }
    try {
      await uploadCoverMutation.mutateAsync(coverFile);
      setCoverFile(null);
      toast.success('Capa atualizada.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha ao enviar capa.');
    }
  };

  const handleCoverUrl = async () => {
    if (!coverUrl.trim()) return;
    try {
      await importCoverUrlMutation.mutateAsync(coverUrl.trim());
      toast.success(coverCapabilities.data?.cloudinary_enabled ? 'Capa copiada.' : 'URL de capa salva.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha ao importar capa.');
    }
  };

  return (
    <PainelShell>
      <h1 className="text-2xl font-bold text-[var(--fg)]">Editar material</h1>

      <section aria-labelledby="material-tasks-title" className="mt-6 max-w-xl rounded-md border border-[var(--line)] p-4">
        <h2 id="material-tasks-title" className="font-semibold text-[var(--fg)]">Etapas para publicar</h2>
        <p className="mt-1 text-sm text-[var(--fg-muted)]">Faça na ordem que preferir. Cada etapa marca ✓ quando você salva — e continua salva se você sair.</p>
        <ul className="mt-3 space-y-2">
          {taskItems.map((item) => (
            <li key={item.label} className="flex gap-2 text-sm text-[var(--fg-muted)]">
              <span aria-hidden="true">{item.done ? '✓' : '○'}</span>
              <span>{item.label}</span>
              <span className="sr-only">{item.done ? 'concluída' : 'pendente'}</span>
            </li>
          ))}
        </ul>
        {material.editorial_state === 'rejected' && (
          <p role="alert" className="mt-4 rounded-md border border-red-500/50 p-3 text-sm text-red-600">
            Rejeitado: {material.rejection_reason ?? 'A moderação não informou um motivo.'}
          </p>
        )}
        {material.editorial_state === 'published' && (
          <div className="mt-4 text-sm text-[var(--fg-muted)]">
            <Link to={`/materiais/${material.slug}`} className="font-semibold text-artificio-orange">Ver material publicado</Link>
            <p className="mt-1">
              {material.avg_rating === null || material.avg_rating === undefined ? 'Sem avaliações' : `${material.avg_rating.toFixed(1)} / 5 (${material.rating_count ?? 0})`}
              {' · '}{material.comment_count ?? 0} comentários · {material.download_count ?? 0} downloads
            </p>
          </div>
        )}
      </section>

      <form onSubmit={handleSubmit} className="mt-6 flex max-w-xl flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm text-[var(--fg-muted)]">
          <span>Título</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="min-h-[44px] rounded-md border border-[var(--line)] bg-transparent px-3 py-2 text-[var(--fg)]"
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm text-[var(--fg-muted)]" htmlFor="material-system">
            <span>Sistema</span>
            <Select
              id="material-system"
              value={systemId}
              onChange={(event) => {
                setSystemId(event.target.value);
                setEditionId('');
              }}
              disabled={catalogSystemsQuery.isPending || catalogSystemsQuery.isError}
            >
              <option value="">Não informado</option>
              {systemOptions.map((system) => (
                <option key={system.id} value={system.id}>{system.name}</option>
              ))}
            </Select>
          </label>

          <label className="flex flex-col gap-1 text-sm text-[var(--fg-muted)]" htmlFor="material-edition">
            <span>Edição ou variante</span>
            <Select
              id="material-edition"
              value={editionId}
              onChange={(event) => setEditionId(event.target.value)}
              disabled={!systemId || catalogSystemsQuery.isPending || catalogSystemsQuery.isError}
            >
              <option value="">Não informada</option>
              {editionOptions.map((edition) => (
                <option key={edition.id} value={edition.id}>{edition.name}</option>
              ))}
            </Select>
          </label>
        </div>

        {catalogSystemsQuery.isError && (
          <div role="alert" className="flex items-center gap-2 text-xs text-red-600">
            <span>Sistemas indisponíveis.</span>
            <button
              type="button"
              onClick={() => void catalogSystemsQuery.refetch()}
              disabled={catalogSystemsQuery.isFetching}
              className="min-h-[44px] rounded-md border border-current px-3 font-semibold disabled:opacity-50"
            >
              Tentar novamente
            </button>
          </div>
        )}

        <div className="flex flex-col gap-2 rounded-md border border-[var(--line)] p-4">
          <label htmlFor="material-cover" className="text-sm font-semibold text-[var(--fg)]">
            Capa do material
          </label>
          <p id="material-cover-guidance" className="text-xs text-[var(--fg-muted)]">
            JPEG, PNG ou WebP; até 5 MB. Dimensão recomendada: 1200 × 630 px. O arquivo é validado antes do envio.
          </p>
          <label htmlFor="material-cover-url" className="text-sm text-[var(--fg-muted)]">URL da capa</label>
          <div className="flex flex-wrap gap-2">
            <input
              id="material-cover-url"
              type="url"
              value={coverUrl}
              onChange={(event) => setCoverUrl(event.target.value)}
              placeholder="https://…"
              className="min-h-[44px] min-w-[220px] flex-1 rounded-md border border-[var(--line)] bg-transparent px-3 py-2 text-[var(--fg)]"
            />
            <button
              type="button"
              onClick={() => void handleCoverUrl()}
              disabled={!coverUrl.trim() || importCoverUrlMutation.isPending}
              className="min-h-[44px] rounded-md border border-[var(--line)] px-4 py-2 font-semibold text-[var(--fg)] disabled:opacity-50"
            >
              {importCoverUrlMutation.isPending ? 'Salvando...' : 'Usar URL'}
            </button>
          </div>
          <input
            key={coverFile ? coverFile.name : 'empty-cover'}
            id="material-cover"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            aria-describedby="material-cover-guidance"
            onChange={(event) => setCoverFile(event.target.files?.[0] ?? null)}
            className="text-sm text-[var(--fg-muted)] file:mr-3 file:min-h-[44px] file:rounded-md file:border file:border-[var(--line)] file:bg-[var(--surface)] file:px-3 file:text-[var(--fg)]"
          />
          <button
            type="button"
            onClick={() => void handleCoverUpload()}
            disabled={!coverCapabilities.data?.cloudinary_enabled || !coverFile || uploadCoverMutation.isPending}
            className="min-h-[44px] w-fit rounded-md border border-[var(--line)] px-4 py-2 font-semibold text-[var(--fg)] disabled:opacity-50"
          >
            {uploadCoverMutation.isPending ? 'Enviando capa...' : 'Enviar capa'}
          </button>
          {!coverCapabilities.data?.cloudinary_enabled && (
            <span className="text-xs text-[var(--fg-muted)]">Upload de arquivo desligado durante o desenvolvimento.</span>
          )}
        </div>

        <div className="flex flex-col gap-1 text-sm text-[var(--fg-muted)]">
          <span>Descrição</span>
          <ContentEditor
            value={descriptionMarkdown}
            onChange={setDescriptionMarkdown}
            label="Descrição do material"
            maxLength={50000}
          />
          <span className="text-xs">Resumo e texto plano são derivados automaticamente.</span>
        </div>

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

        <label className="flex flex-col gap-1 text-sm text-[var(--fg-muted)]">
          <span>Autores</span>
          <input
            value={authors}
            onChange={(event) => setAuthors(event.target.value)}
            placeholder="Separe vários nomes por vírgula"
            className="min-h-[44px] rounded-md border border-[var(--line)] bg-transparent px-3 py-2 text-[var(--fg)]"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm text-[var(--fg-muted)]">
          <span>Artistas</span>
          <input
            value={artists}
            onChange={(event) => setArtists(event.target.value)}
            placeholder="Separe vários nomes por vírgula"
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
