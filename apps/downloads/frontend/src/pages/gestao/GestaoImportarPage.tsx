import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { GestaoShell } from '../../components/GestaoShell';
import {
  useParseOneBookShelfHtml,
  oneBookShelfSourcePlatformSchema,
  type OneBookShelfPreview,
  type OneBookShelfSourcePlatform,
  type DuplicateCandidate,
} from '../../hooks/useParseOneBookShelfHtml';
import { useIngestScrapedItems } from '../../hooks/useIngestScrapedItems';

const PRICE_SIGNAL_LABEL: Record<OneBookShelfPreview['priceSignal'], string> = {
  pwyw_tag_present: 'Pague quanto quiser (confirmado no HTML)',
  zero_price_no_pwyw_tag: 'Grátis (preço $0.00, sem opção de PWYW)',
  nonzero_price_no_pwyw_tag: 'Preço diferente de zero, sem tag de PWYW — parece pago',
};

// T5.1 (spec 085) — pagina nova (/gestao/materiais/importar): admin cola
// HTML de produto DMs Guild/DriveThruRPG, ve preview extraido +
// candidatos de duplicata (Fase 3), edita campos e confirma publicacao
// (T5.2, POST /ingest ja existente). priceSignal='nonzero_price_no_pwyw_tag'
// bloqueia confirmar ate o admin editar manualmente isFreeOrPwyw (D119).
export function GestaoImportarPage() {
  const parseMutation = useParseOneBookShelfHtml();
  const ingestMutation = useIngestScrapedItems();

  const [sourcePlatform, setSourcePlatform] = useState<OneBookShelfSourcePlatform>('dms_guild');
  const [html, setHtml] = useState('');

  const [preview, setPreview] = useState<OneBookShelfPreview | null>(null);
  const [duplicateCandidates, setDuplicateCandidates] = useState<DuplicateCandidate[]>([]);
  const [parseCaseId, setParseCaseId] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [coverImageUrl, setCoverImageUrl] = useState('');
  const [publisherName, setPublisherName] = useState('');
  const [isFreeOrPwyw, setIsFreeOrPwyw] = useState(false);
  const [priceSignalOverridden, setPriceSignalOverridden] = useState(false);

  const handleAnalisar = async (event: FormEvent) => {
    event.preventDefault();
    try {
      const result = await parseMutation.mutateAsync({ source_platform: sourcePlatform, html });
      setPreview(result.preview);
      setDuplicateCandidates(result.duplicateCandidates);
      setParseCaseId(result.parse_case_id);
      setTitle(result.preview.title);
      setDescription(result.preview.description ?? '');
      setCoverImageUrl(result.preview.coverImageUrl ?? '');
      setPublisherName(result.preview.publisherName ?? '');
      setIsFreeOrPwyw(result.preview.isFreeOrPwyw ?? false);
      setPriceSignalOverridden(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha ao analisar HTML.');
    }
  };

  const needsManualPriceReview = preview?.priceSignal === 'nonzero_price_no_pwyw_tag';
  const canConfirm = !needsManualPriceReview || priceSignalOverridden;

  const handleConfirmar = async () => {
    if (!preview) return;
    try {
      await ingestMutation.mutateAsync({
        source_platform: sourcePlatform,
        items: [
          {
            sourceUrl: preview.sourceUrl,
            title: title.trim(),
            description: description.trim() || null,
            isFreeOrPwyw,
            coverImageUrl: coverImageUrl.trim() || null,
            publisherName: publisherName.trim() || null,
            sourceLanguageHint: preview.sourceLanguageHint,
            parse_case_id: parseCaseId ?? undefined,
          },
        ],
      });
      toast.success('Material publicado.');
      setPreview(null);
      setDuplicateCandidates([]);
      setParseCaseId(null);
      setHtml('');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha ao publicar material.');
    }
  };

  return (
    <GestaoShell>
      <h1 className="text-2xl font-bold text-[var(--fg)]">Importar de HTML colado</h1>
      <p className="mt-2 text-sm text-[var(--fg-muted)]">
        Cole o HTML de um produto DMs Guild ou DriveThruRPG (View Source pós-carregamento). Nenhum HTML é armazenado —
        só o preview extraído é gravado.
      </p>

      <form onSubmit={handleAnalisar} className="mt-6 flex max-w-2xl flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm text-[var(--fg-muted)]">
          <span>Plataforma</span>
          <select
            value={sourcePlatform}
            onChange={(e) => setSourcePlatform(oneBookShelfSourcePlatformSchema.parse(e.target.value))}
            className="min-h-[44px] rounded-md border border-[var(--line)] bg-transparent px-3 py-2 text-[var(--fg)]"
          >
            <option value="dms_guild">DMs Guild</option>
            <option value="drivethrurpg">DriveThruRPG</option>
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm text-[var(--fg-muted)]">
          <span>HTML da página do produto</span>
          <textarea
            required
            value={html}
            onChange={(e) => setHtml(e.target.value)}
            rows={10}
            placeholder="Cole aqui o HTML completo da página do produto"
            className="rounded-md border border-[var(--line)] bg-transparent px-3 py-2 font-mono text-xs text-[var(--fg)]"
          />
        </label>

        <button
          type="submit"
          disabled={parseMutation.isPending || !html.trim()}
          className="min-h-[44px] w-fit rounded-md bg-artificio-orange px-6 py-2 font-semibold text-white hover:bg-artificio-orange-hover disabled:opacity-50"
        >
          {parseMutation.isPending ? 'Analisando...' : 'Analisar'}
        </button>
      </form>

      {preview && (
        <div className="mt-8 max-w-2xl border-t border-[var(--line)] pt-6">
          <h2 className="text-lg font-semibold text-[var(--fg)]">Preview extraído</h2>

          <div className="mt-2 rounded-md border border-[var(--line)] bg-[var(--surface-subtle)] px-3 py-2 text-sm text-[var(--fg)]">
            <p>
              Preço extraído: <strong>{preview.extractedPriceValue ?? 'não identificado'}</strong>
            </p>
            <p>Sinal de preço: {PRICE_SIGNAL_LABEL[preview.priceSignal]}</p>
          </div>

          {needsManualPriceReview && (
            <div role="alert" className="mt-3 rounded-md border border-red-500 bg-red-500/10 px-3 py-2 text-sm text-red-400">
              Produto parece pago (preço diferente de zero, sem tag de PWYW). Confirme manualmente o campo &quot;Grátis ou
              pague quanto quiser&quot; abaixo antes de publicar.
            </div>
          )}

          {duplicateCandidates.length > 0 && (
            <div role="alert" className="mt-3 rounded-md border border-yellow-500 bg-yellow-500/10 px-3 py-2 text-sm text-yellow-400">
              <p className="font-semibold">Possíveis duplicatas encontradas:</p>
              <ul className="mt-1 list-inside list-disc">
                {duplicateCandidates.map((candidate) => (
                  <li key={candidate.id}>
                    <Link to={`/materiais/${candidate.slug}`} target="_blank" rel="noreferrer" className="underline">
                      {candidate.title}
                    </Link>{' '}
                    (similaridade {(candidate.similarity * 100).toFixed(0)}%)
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-4 flex flex-col gap-4">
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
              <span>Descrição</span>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                className="rounded-md border border-[var(--line)] bg-transparent px-3 py-2 text-[var(--fg)]"
              />
            </label>

            <label className="flex flex-col gap-1 text-sm text-[var(--fg-muted)]">
              <span>URL da capa</span>
              <input
                value={coverImageUrl}
                onChange={(e) => setCoverImageUrl(e.target.value)}
                className="min-h-[44px] rounded-md border border-[var(--line)] bg-transparent px-3 py-2 text-[var(--fg)]"
              />
            </label>

            <label className="flex flex-col gap-1 text-sm text-[var(--fg-muted)]">
              <span>Editora</span>
              <input
                value={publisherName}
                onChange={(e) => setPublisherName(e.target.value)}
                className="min-h-[44px] rounded-md border border-[var(--line)] bg-transparent px-3 py-2 text-[var(--fg)]"
              />
            </label>

            <label className="flex items-center gap-2 text-sm text-[var(--fg-muted)]">
              <input
                type="checkbox"
                checked={isFreeOrPwyw}
                onChange={(e) => {
                  setIsFreeOrPwyw(e.target.checked);
                  setPriceSignalOverridden(true);
                }}
                className="h-5 w-5"
              />
              <span>Grátis ou pague quanto quiser</span>
            </label>
          </div>

          <button
            type="button"
            onClick={handleConfirmar}
            disabled={!canConfirm || ingestMutation.isPending}
            title={!canConfirm ? 'Confirme o campo "Grátis ou pague quanto quiser" antes de publicar' : undefined}
            className="mt-6 min-h-[44px] w-fit rounded-md bg-artificio-orange px-6 py-2 font-semibold text-white hover:bg-artificio-orange-hover disabled:opacity-50"
          >
            {ingestMutation.isPending ? 'Publicando...' : 'Confirmar e publicar'}
          </button>
        </div>
      )}
    </GestaoShell>
  );
}
