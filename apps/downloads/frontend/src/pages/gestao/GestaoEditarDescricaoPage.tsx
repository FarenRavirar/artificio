import { useState, type FormEvent } from 'react';
import { ContentEditor, contentOverflow } from '@artificio/content-editor';
import { PageHeader, SectionCard } from '@artificio/ui/admin';
import { useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { GestaoShell } from '../../components/GestaoShell';
import { useAdminMedia } from '../../hooks/useAdminMedia';
import { useUpdateMaterialMetadata } from '../../hooks/useUpdateMaterialMetadata';

// Espelha o limite aceito pelo backend para a descricao do material.
const DESCRIPTION_MAX_LENGTH = 50000;

export function GestaoEditarDescricaoPage() {
  const { materialId } = useParams<{ materialId: string }>();
  const { data, isLoading } = useAdminMedia();
  const material = data?.items.find((item) => item.material_id === materialId);
  const updateMetadata = useUpdateMaterialMetadata(materialId ?? '');
  const [descriptionMarkdown, setDescriptionMarkdown] = useState('');
  const [loadedMaterialId, setLoadedMaterialId] = useState<string | undefined>();

  if (material && loadedMaterialId !== material.material_id) {
    setLoadedMaterialId(material.material_id);
    setDescriptionMarkdown(material.description_markdown ?? '');
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    try {
      await updateMetadata.mutateAsync({
        description_markdown: descriptionMarkdown.trim() || null,
      });
      toast.success('Descrição atualizada.');
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : 'Falha ao salvar descrição.');
    }
  }

  if (isLoading) {
    return <GestaoShell><p className="text-[var(--admin-fg-low)]">Carregando…</p></GestaoShell>;
  }

  if (!materialId || !material) {
    return <GestaoShell><p className="text-[var(--admin-fg-low)]">Material não encontrado.</p></GestaoShell>;
  }

  return (
    <GestaoShell>
      <PageHeader
        breadcrumb={['Materiais', material.material_title]}
        title="Editar descrição"
        description="Markdown GFM exibido na ficha pública. O servidor sanitiza o texto antes de persistir e ao servir."
      />

      <form onSubmit={handleSubmit} className="mt-6">
        <SectionCard title={material.material_title} description={`Estado: ${material.editorial_state}`}>
          <ContentEditor
            value={descriptionMarkdown}
            onChange={setDescriptionMarkdown}
            disabled={updateMetadata.isPending}
            label={`Descrição de ${material.material_title}`}
            maxLength={DESCRIPTION_MAX_LENGTH}
          />
          <div className="mt-4 flex justify-end">
            <button
              type="submit"
              disabled={updateMetadata.isPending || contentOverflow(descriptionMarkdown.trim(), DESCRIPTION_MAX_LENGTH) > 0}
              className="min-h-11 rounded-md bg-artificio-orange px-5 py-2 font-semibold text-white disabled:opacity-50"
            >
              {updateMetadata.isPending ? 'Salvando…' : 'Salvar descrição'}
            </button>
          </div>
        </SectionCard>
      </form>
    </GestaoShell>
  );
}
