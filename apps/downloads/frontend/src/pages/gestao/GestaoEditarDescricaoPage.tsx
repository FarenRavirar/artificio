import { useState, type FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { PageHeader, SectionCard } from '@artificio/ui/admin';
import { GestaoShell } from '../../components/GestaoShell';
import { RichTextEditor } from '../../components/RichTextEditor';
import { useAdminMedia } from '../../hooks/useAdminMedia';
import { useUpdateMaterialMetadata } from '../../hooks/useUpdateMaterialMetadata';

// Achado real (review PR #209, GitHub Advanced Security/CodeQL, high):
// strip de tag por regex (/<[^>]*>/g) é sanitização incompleta — string com
// tag quebrada/aninhada pode manter "<script" de fora do match e o linter
// sinaliza injeção potencial. Isto aqui só decide se o HTML é "vazio" pra
// gravar null (não é a sanitização real: essa é sempre no servidor,
// sanitizeRichHtml.ts, AGENTS.md). Troca pra DOMParser: extrai texto via
// árvore DOM real, sem regex tentando emular parser de HTML.
// Tags sem texto próprio que ainda assim são conteúdo real (o TipTap emite
// <p></p> pra documento genuinamente vazio, e isso continua devendo virar
// null — só as tags abaixo contam como "tem algo" sem precisar de texto).
const STRUCTURAL_EMPTY_TAGS = new Set(['img', 'hr']);

function normalizedRichHtml(value: string): string | null {
  const parsed = new DOMParser().parseFromString(value, 'text/html');
  const text = (parsed.body.textContent ?? '').replace(/ /g, ' ').trim();
  // Achado real (review PR #209, Codex, nitpick): checar só <img> descartava
  // descrição com outro conteúdo estrutural sem texto próprio (ex.: só
  // <hr>) como se fosse vazia. Generaliza pra qualquer tag da lista acima,
  // em vez de checar só <img> — mas continua exigindo texto ou uma dessas
  // tags: <p></p> sozinho (documento vazio real do TipTap) segue virando
  // null.
  const hasStructuralContent = parsed.body.querySelector([...STRUCTURAL_EMPTY_TAGS].join(',')) !== null;
  return hasStructuralContent || text ? value : null;
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
