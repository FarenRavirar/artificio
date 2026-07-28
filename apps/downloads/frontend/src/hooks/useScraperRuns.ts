import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { apiGet, apiPost } from '../services/apiClient';

// Spec 089 (T5.4) — a recoleta das fontes era disparada colando `fetch` no
// console do navegador, e isso já falhou por prefixo de rota errado
// (/api/v1/scraper vs /api/v1/admin/scraper) numa janela de limpeza. O painel
// existe pra que a operação não dependa de path digitado à mão.

const scraperRunStatusSchema = z.enum(['running', 'completed', 'failed']);
export type ScraperRunStatus = z.infer<typeof scraperRunStatusSchema>;

// Espelha DownloadScraperRunTable (backend/src/db/types.ts:235). Contadores
// são NOT NULL com default no banco; `catch(0)` cobre run antiga cujo valor
// tenha vindo nulo, sem quebrar a tela inteira.
const scraperRunSchema = z.object({
  id: z.string(),
  source_platform: z.string(),
  trigger_kind: z.string(),
  status: scraperRunStatusSchema,
  items_found: z.number().nullable().catch(0),
  items_created: z.number().nullable().catch(0),
  items_skipped_duplicate: z.number().nullable().catch(0),
  items_skipped_not_portuguese: z.number().nullable().catch(0),
  items_skipped_error: z.number().nullable().catch(0),
  item_log_failures: z.number().nullable().catch(0),
  item_log_error_detail: z.string().nullable(),
  error_detail: z.string().nullable(),
  started_at: z.string(),
  finished_at: z.string().nullable(),
});
export type ScraperRun = z.infer<typeof scraperRunSchema>;

const listRunsResponseSchema = z.object({
  items: z.array(scraperRunSchema),
});

const startRunResponseSchema = z.object({
  run_id: z.string(),
});

const POLL_INTERVAL_MS = 3000;

// Polling só ENQUANTO houver run ativa — achado de review PR #224 (Codex, P1):
// polling perpétuo de 3s gera 300 req/15min e estoura o rate limiter da rota,
// congelando a tela justamente quando ela importa. Sem run ativa a lista só
// muda por ação do próprio admin, que já invalida a query. Enquanto a lista
// ainda não carregou (`undefined`), mantém o poll: pode haver run em curso
// iniciada por outra aba ou pelo cron.
export function resolvePollInterval(rows: ScraperRun[] | undefined): number | false {
  if (!Array.isArray(rows)) return POLL_INTERVAL_MS;
  return rows.some((run) => run.status === 'running') ? POLL_INTERVAL_MS : false;
}

export function useScraperRuns(options?: { poll?: boolean }) {
  return useQuery({
    queryKey: ['downloads', 'admin', 'scraper', 'runs'],
    queryFn: async (): Promise<ScraperRun[]> => {
      const response = await apiGet('/api/v1/admin/scraper/runs');
      if (!response.ok) {
        throw new Error(`Falha ao listar runs: HTTP ${response.status}`);
      }
      return listRunsResponseSchema.parse(await response.json()).items;
    },
    // Run é fire-and-forget (scraper.ts): o POST devolve 202 e a execução segue
    // assíncrona, então a tela precisa de polling para não mentir "running" pra
    // sempre. A cadência em si vive em resolvePollInterval.
    refetchInterval: (query) => (options?.poll === false ? false : resolvePollInterval(query.state.data)),
  });
}

export function useStartScraperRun() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (sourcePlatform: string): Promise<string> => {
      const response = await apiPost('/api/v1/admin/scraper/run', {
        source_platform: sourcePlatform,
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error ?? `Falha ao disparar run: HTTP ${response.status}`);
      }
      return startRunResponseSchema.parse(await response.json()).run_id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['downloads', 'admin', 'scraper', 'runs'] });
    },
  });
}

export interface RunAcceptance {
  passed: boolean;
  failures: string[];
}

// Critérios de aceite do T5.4 (spec 089). `status='completed'` não prova run
// saudável: executeScraperRun (scraper.ts:60) marca completed sem olhar
// contador, então uma run que não achou nada, ou que errou em todos os itens,
// completa igual. A soma fecha a conta e denuncia item perdido em silêncio.
export function evaluateRunAcceptance(run: ScraperRun): RunAcceptance {
  const found = run.items_found ?? 0;
  const created = run.items_created ?? 0;
  const duplicate = run.items_skipped_duplicate ?? 0;
  const notPortuguese = run.items_skipped_not_portuguese ?? 0;
  const errored = run.items_skipped_error ?? 0;
  const logFailures = run.item_log_failures ?? 0;

  const failures: string[] = [];
  if (run.status !== 'completed') failures.push(`status = ${run.status}`);
  if (found <= 0) failures.push('items_found = 0');
  if (created <= 0) failures.push('items_created = 0');
  if (errored > 0) failures.push(`items_skipped_error = ${errored}`);
  if (logFailures > 0) failures.push(`item_log_failures = ${logFailures}`);

  const sum = created + duplicate + notPortuguese + errored;
  if (found !== sum) failures.push(`found (${found}) ≠ created+duplicate+not_portuguese+error (${sum})`);

  return { passed: failures.length === 0, failures };
}
