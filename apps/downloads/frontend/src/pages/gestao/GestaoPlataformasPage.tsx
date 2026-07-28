import { useState, type FormEvent } from 'react';
import toast from 'react-hot-toast';
import { AdminTable, PageHeader, SectionCard, type AdminColumn } from '@artificio/ui/admin';
import { GestaoShell } from '../../components/GestaoShell';
import { usePlatforms, useCreatePlatform } from '../../hooks/usePlatforms';
import {
  evaluateRunAcceptance,
  useScraperRuns,
  useStartScraperRun,
  type ScraperRun,
} from '../../hooks/useScraperRuns';

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
// Spec 089 (T5.4) — bloco de coleta. Fica nesta página, e não numa rota nova,
// porque o registry de plataformas já é a fonte da lista: "onde se cadastra a
// fonte" e "onde se dispara a coleta dela" são a mesma pergunta pro admin.
function ColetaSection() {
  const { data: platforms, isLoading: platformsLoading } = usePlatforms();
  const { data: runs, isLoading: runsLoading } = useScraperRuns();
  const startRun = useStartScraperRun();
  const [selected, setSelected] = useState('');
  // A lista de runs só reflete o disparo no próximo refetch, e até lá
  // `hasRunning` continua false — o botão reabriria por até um ciclo de poll,
  // permitindo disparo duplo. O backend agora rejeita o segundo com 409
  // (scraper.ts, INSERT ... WHERE NOT EXISTS), mas a tela não deve oferecer uma
  // ação que ela sabe que vai falhar.
  const [disparoConfirmadoPendente, setDisparoConfirmadoPendente] = useState(false);

  // Só plataforma com scraper automático implementado pode ser disparada. O
  // backend valida o mesmo (scraper.ts:433 exige supports_auto_scrape contra
  // IMPLEMENTED_SOURCE_PLATFORMS) — aqui é pra não oferecer o que dá 400.
  const runnable = (platforms ?? []).filter((p) => p.supports_auto_scrape);
  const hasRunning = (runs ?? []).some((run) => run.status === 'running');

  const handleRun = async () => {
    if (!selected) return;
    setDisparoConfirmadoPendente(true);
    try {
      const runId = await startRun.mutateAsync(selected);
      toast.success(`Run disparada: ${runId.slice(0, 8)}`);
    } catch (error) {
      // Falha no disparo não deixa run ativa — reabrir o botão de imediato,
      // senão o admin fica travado esperando uma confirmação que não vem.
      setDisparoConfirmadoPendente(false);
      toast.error(error instanceof Error ? error.message : 'Falha ao disparar run.');
    }
  };

  // Derivado, não sincronizado por efeito: assim que a lista confirma a run, a
  // espera deixa de valer sozinha — `setState` dentro de `useEffect` para isso
  // dispara render em cascata e é barrado por `react-hooks/set-state-in-effect`.
  const aguardandoConfirmacao = disparoConfirmadoPendente && !hasRunning;
  const disparoBloqueado = startRun.isPending || hasRunning || aguardandoConfirmacao;

  const columns: Array<AdminColumn<ScraperRun>> = [
    { key: 'source_platform', header: 'Fonte', render: (row) => row.source_platform },
    {
      key: 'status',
      header: 'Status',
      render: (row) => {
        if (row.status === 'running') return <span className="text-amber-600">Executando…</span>;
        if (row.status === 'failed') {
          return <span className="text-red-600" title={row.error_detail ?? undefined}>Falhou</span>;
        }
        return <span className="text-emerald-700">Concluída</span>;
      },
    },
    { key: 'items_found', header: 'Achados', render: (row) => row.items_found ?? 0 },
    { key: 'items_created', header: 'Criados', render: (row) => row.items_created ?? 0 },
    { key: 'items_skipped_duplicate', header: 'Duplicados', render: (row) => row.items_skipped_duplicate ?? 0 },
    { key: 'items_skipped_not_portuguese', header: 'Não-PT', render: (row) => row.items_skipped_not_portuguese ?? 0 },
    { key: 'items_skipped_error', header: 'Erros', render: (row) => row.items_skipped_error ?? 0 },
    {
      key: 'item_log_failures',
      header: 'Falhas de log',
      render: (row) => (
        <span title={row.item_log_error_detail ?? undefined}>{row.item_log_failures ?? 0}</span>
      ),
    },
    {
      key: 'aceite',
      header: 'Aceite',
      render: (row) => {
        if (row.status === 'running') return <span className="text-[var(--admin-fg-low)]">—</span>;
        const { passed, failures } = evaluateRunAcceptance(row);
        if (passed) return <span className="text-emerald-700">Passou</span>;
        return (
          <span className="text-red-600" title={failures.join('; ')}>
            Reprovou ({failures.length})
          </span>
        );
      },
    },
  ];

  return (
    <SectionCard title="Coletar de uma fonte" className="mt-6">
      <div className="flex flex-col gap-4">
        <p className="text-sm text-[var(--admin-fg-low)]">
          Dispara a coleta automática da fonte escolhida. A execução é assíncrona: a tabela abaixo
          atualiza sozinha a cada 3 segundos. Rode <span className="font-semibold">uma fonte por vez</span> e
          espere a anterior concluir — runs simultâneas disputam o mesmo pipeline de ingestão.
        </p>

        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-sm text-[var(--admin-fg-low)]">
            <span>Fonte</span>
            <select
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
              className="min-h-[44px] min-w-[16rem] rounded-md border border-[var(--admin-border)] bg-transparent px-3 py-2 text-[var(--admin-fg)]"
            >
              <option value="">Selecione…</option>
              {runnable.map((platform) => (
                <option key={platform.slug} value={platform.slug}>
                  {platform.name} ({platform.slug})
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            onClick={handleRun}
            disabled={!selected || disparoBloqueado}
            className="min-h-[44px] rounded-md bg-artificio-orange px-6 py-2 font-semibold text-white hover:bg-artificio-orange-hover disabled:opacity-50"
          >
            {startRun.isPending ? 'Disparando...' : 'Coletar agora'}
          </button>
        </div>

        {(hasRunning || aguardandoConfirmacao) && (
          <p className="text-sm text-amber-700">
            Há uma run em andamento. Espere concluir antes de disparar a próxima.
          </p>
        )}

        {!platformsLoading && runnable.length === 0 && (
          <p className="text-sm text-[var(--admin-fg-low)]">
            Nenhuma plataforma com coleta automática habilitada. Marque{' '}
            <span className="font-semibold">Coleta automática</span> no cadastro abaixo — só slug com scraper
            implementado aceita a marcação.
          </p>
        )}

        <AdminTable<ScraperRun>
          tableId="gestao-scraper-runs"
          rows={runs ?? []}
          getRowId={(row) => row.id}
          columns={columns}
          loading={runsLoading}
          emptyTitle="Nenhuma run registrada."
        />
      </div>
    </SectionCard>
  );
}

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

      <ColetaSection />

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
