import { useEffect, useState } from 'react';
import { api } from '../../../services/apiClient';

/** Linha de `client_errors` como a rota admin devolve (spec 106 R19). */
interface ClientErrorRow {
  id: string;
  first_seen: string;
  last_seen: string;
  occurrences: number;
  user_id: string | null;
  route_pattern: string;
  path: string;
  message: string;
  stack: string;
  component_stack: string;
  user_agent: string;
  build: string;
}

const isRow = (value: unknown): value is ClientErrorRow =>
  typeof value === 'object' && value !== null && typeof (value as ClientErrorRow).id === 'string';

const fmt = (iso: string) => new Date(iso).toLocaleString('pt-BR');

// Somente leitura. Todo campo vem do navegador de um visitante qualquer: sai como
// texto do React (nunca `dangerouslySetInnerHTML`).
export const ClientErrorsPanel = () => {
  const [rows, setRows] = useState<ClientErrorRow[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    api
      .get<{ data: unknown }>('/api/v1/admin/client-errors')
      .then((res) => {
        if (alive) setRows(Array.isArray(res.data) ? res.data.filter(isRow) : []);
      })
      .catch(() => {
        if (alive) setFailed(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  if (failed) return <p role="alert">Não foi possível carregar os erros do navegador.</p>;
  if (!rows) return <p>Carregando…</p>;
  if (rows.length === 0) return <p>Nenhum erro de navegador nos últimos 90 dias.</p>;

  return (
    <ul className="space-y-3">
      {rows.map((row) => (
        <li key={row.id} className="rounded-lg border border-[var(--border)] p-3">
          <p className="font-medium break-words">{row.message}</p>
          <p className="text-sm opacity-80">
            {row.route_pattern || row.path || 'sem rota'} · {row.occurrences}× · primeira {fmt(row.first_seen)} ·
            última {fmt(row.last_seen)} · {row.user_id ? 'usuário logado' : 'anônimo'}
          </p>
          <details className="mt-1 text-sm">
            <summary className="cursor-pointer">Detalhes técnicos</summary>
            <pre className="whitespace-pre-wrap break-words">{[row.stack, row.component_stack, row.user_agent, row.build].filter(Boolean).join('\n\n')}</pre>
          </details>
        </li>
      ))}
    </ul>
  );
};
