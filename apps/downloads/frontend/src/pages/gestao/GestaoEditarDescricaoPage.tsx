import { useState, type FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { PageHeader, SectionCard } from '@artificio/ui/admin';
import { GestaoShell } from '../../components/GestaoShell';
import { RichTextEditor } from '../../components/RichTextEditor';
import { useAdminMedia } from '../../hooks/useAdminMedia';
import { useUpdateMaterialMetadata } from '../../hooks/useUpdateMaterialMetadata';

function normalizedRichHtml(value: string): string | null {
  const containsImage = /<img\b/i.test(value);
  const text = value.replace(/<[^>]*>/g, '').replace(/&nbsp;/gi, ' ').trim();
  return containsImage || text ? value : null;
}

// Spec 086, T9.3: editor vive na gestão. Painel do criador mantém descrição
// simples; isso cumpre requisito 4 sem espalhar dois contratos de HTML rico.
export function GestaoEditarDescricaoPage() {
  const { materialId } = useParams<{ materialId: string }>();
  const { data, isLoading } = useAdminMedia();
  const material = data?.items.find((item) => item.material_id === materialId);
  const updateMetadata = useUpdateMaterialMetadata(materialId ?? '');
  const [descriptionHtml, setDescriptionHtml] = useState('');
  const [loadedMaterialId, setLoadedMaterialId] = useState<string | undefined>();

  if (material && loadedMaterialId !== material.material_id) {
    setLoadedMaterialId(material.material_id);
    setDescriptionHtml(material.description_html ?? '');
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    try {
      await updateMetadata.mutateAsync({ description_html: normalizedRichHtml(descriptionHtml) });
      toast.success('Descrição rica atualizada.');
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
        title="Editar descrição rica"
        description="Formatação visual exibida na ficha pública. O servidor sanitiza o HTML antes de persistir e ao servir."
      />

      <form onSubmit={handleSubmit} className="mt-6">
        <SectionCard title={material.material_title} description={`Estado: ${material.editorial_state}`}>
          <RichTextEditor
            value={descriptionHtml}
            onChange={setDescriptionHtml}
            disabled={updateMetadata.isPending}
            label={`Descrição rica de ${material.material_title}`}
          />
          <div className="mt-4 flex justify-end">
            <button
              type="submit"
              disabled={updateMetadata.isPending}
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
