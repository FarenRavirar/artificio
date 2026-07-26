import { useState, type FormEvent } from 'react';
import toast from 'react-hot-toast';
import { AdminTable, PageHeader, SectionCard, type AdminColumn } from '@artificio/ui/admin';
import { GestaoShell } from '../../components/GestaoShell';
import { usePlatforms, useCreatePlatform } from '../../hooks/usePlatforms';

// Espelha backend/src/services/scrapers/platformOverrides (KNOWN_PARSER_KINDS)
// — fonte real fica lá (código), este array é só a lista pro <select>;
// cadastrar um kind fora daqui já é rejeitado com 422 pelo backend.
const PARSER_KINDS = ['json_ld_generic', 'onebookshelf'] as const;

interface PlatformRow {
  slug: string;
  name: string;
  domain: string | null;
  parser_kind: string;
  supports_auto_scrape: boolean;
  supports_price_recheck: boolean;
}

// T6.4/T8.2 (spec 085, D-D) — rota de sistema (/gestao/plataformas, grupo
// "Sistema" da sidebar), não parte do fluxo de Importar: admin cadastra
// site novo (100+ previstos) sem deploy. Peculiaridade de site sempre vira
// override em código (T7.2), nunca configurável aqui — só domínio+nome são
// exigidos, o resto é opcional/default. Fase 5C (spec 086): reconstruida
// sobre PageHeader/SectionCard/AdminTable do kit compartilhado (T5C.5).
export function GestaoPlataformasPage() {
  const { data: platforms, isLoading } = usePlatforms();
  const createMutation = useCreatePlatform();

  const [slug, setSlug] = useState('');
  const [name, setName] = useState('');
  const [domain, setDomain] = useState('');
  const [supportsAutoScrape, setSupportsAutoScrape] = useState(false);
  const [supportsPriceRecheck, setSupportsPriceRecheck] = useState(false);
  const [parserKind, setParserKind] = useState<(typeof PARSER_KINDS)[number]>('json_ld_generic');

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    try {
      await createMutation.mutateAsync({
        slug: slug.trim(),
        name: name.trim(),
        domain: domain.trim() || null,
        supports_auto_scrape: supportsAutoScrape,
        supports_price_recheck: supportsPriceRecheck,
        parser_kind: parserKind,
      });
      toast.success('Plataforma cadastrada.');
      setSlug('');
      setName('');
      setDomain('');
      setSupportsAutoScrape(false);
      setSupportsPriceRecheck(false);
      setParserKind('json_ld_generic');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha ao cadastrar plataforma.');
    }
  };

  const columns: Array<AdminColumn<PlatformRow>> = [
    { key: 'name', header: 'Nome', render: (row) => row.name },
    { key: 'slug', header: 'Slug', render: (row) => <span className="font-mono text-xs">{row.slug}</span> },
    { key: 'domain', header: 'Domínio', render: (row) => row.domain ?? '—' },
    { key: 'parser_kind', header: 'Parser', render: (row) => row.parser_kind },
    { key: 'supports_auto_scrape', header: 'Auto-scrape', render: (row) => (row.supports_auto_scrape ? 'Sim' : 'Não') },
    { key: 'supports_price_recheck', header: 'Re-check preço', render: (row) => (row.supports_price_recheck ? 'Sim' : 'Não') },
  ];

  return (
    <GestaoShell>
      <PageHeader
        title="Plataformas"
        description={
          <>
            Registro de sites de origem que o admin pode importar via{' '}
            <span className="font-semibold">Importar de HTML</span>. Cadastrar um site novo aqui não exige deploy —
            só domínio e nome são obrigatórios; peculiaridade de layout (ex.: sinal de preço PWYW) sempre vira
            código (override), nunca configuração aqui.
          </>
        }
      />

      <SectionCard title="Cadastrar plataforma" className="mt-6">
        <form onSubmit={handleSubmit} className="flex max-w-xl flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm text-[var(--admin-fg-low)]">
            <span>Slug (identificador único, letras minúsculas/números/underscore)</span>
            <input
              required
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="ex.: loja_exemplo"
              className="min-h-[44px] rounded-md border border-[var(--admin-border)] bg-transparent px-3 py-2 text-[var(--admin-fg)]"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm text-[var(--admin-fg-low)]">
            <span>Nome de exibição</span>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ex.: Loja Exemplo"
              className="min-h-[44px] rounded-md border border-[var(--admin-border)] bg-transparent px-3 py-2 text-[var(--admin-fg)]"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm text-[var(--admin-fg-low)]">
            <span>Domínio (hostname puro, sem scheme/path/porta)</span>
            <input
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              placeholder="ex.: loja.exemplo.com.br"
              className="min-h-[44px] rounded-md border border-[var(--admin-border)] bg-transparent px-3 py-2 text-[var(--admin-fg)]"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm text-[var(--admin-fg-low)]">
            <span>Parser</span>
            <select
              value={parserKind}
              onChange={(e) => setParserKind(e.target.value as (typeof PARSER_KINDS)[number])}
              className="min-h-[44px] rounded-md border border-[var(--admin-border)] bg-transparent px-3 py-2 text-[var(--admin-fg)]"
            >
              {PARSER_KINDS.map((kind) => (
                <option key={kind} value={kind}>
                  {kind === 'json_ld_generic' ? 'Genérico (JSON-LD Schema.org)' : kind}
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-2 text-sm text-[var(--admin-fg-low)]">
            <input
              type="checkbox"
              checked={supportsAutoScrape}
              onChange={(e) => setSupportsAutoScrape(e.target.checked)}
              className="h-5 w-5"
            />
            <span>Coleta automática (cron diário)</span>
          </label>

          <label className="flex items-center gap-2 text-sm text-[var(--admin-fg-low)]">
            <input
              type="checkbox"
              checked={supportsPriceRecheck}
              onChange={(e) => setSupportsPriceRecheck(e.target.checked)}
              className="h-5 w-5"
            />
            <span>Re-checagem de preço pós-publicação</span>
          </label>

          <button
            type="submit"
            disabled={createMutation.isPending || !slug.trim() || !name.trim()}
            className="min-h-[44px] w-fit rounded-md bg-artificio-orange px-6 py-2 font-semibold text-white hover:bg-artificio-orange-hover disabled:opacity-50"
          >
            {createMutation.isPending ? 'Cadastrando...' : 'Cadastrar'}
          </button>
        </form>
      </SectionCard>

      <div className="mt-6">
        <AdminTable<PlatformRow>
          tableId="gestao-plataformas"
          rows={platforms ?? []}
          getRowId={(row) => row.slug}
          columns={columns}
          searchKeys={['name', 'slug', 'domain']}
          loading={isLoading}
          emptyTitle="Nenhuma plataforma cadastrada."
        />
      </div>
    </GestaoShell>
  );
}
