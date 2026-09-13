import { data } from 'react-router';
import type { LoaderFunctionArgs, MetaArgs } from 'react-router';
import { MesaPage } from '../pages/MesaPage';
import { apiUrl } from '../lib/apiUrl';
import { normalizeClosedTable, type ClosedTable } from '../pages/closedTable';
import type { TableDetail } from '../types/tables';
import { buildTableMeta } from '../features/table/seo/tableMeta';

export type MesaLoaderData =
  | { kind: 'ok'; table: TableDetail }
  | { kind: 'gone'; closed: ClosedTable };

/**
 * Busca a mesa NO SERVIDOR (spec 102 T4.2).
 *
 * Antes, `MesaPage` buscava por `useEffect` — que não roda no servidor. O HTML
 * saía com "Carregando…" e era isso que Googlebot e os crawlers de IA (que não
 * executam JS) recebiam. Com o `loader`, o dado chega antes do render e o título,
 * o preço e as vagas nascem dentro do HTML, que é o que a regra pétrea de T4.3
 * exige: nenhum fato pode existir só no JSON-LD.
 *
 * Os status são repassados como status da PÁGINA, não engolidos num `200`. É a
 * mesma classificação de `routes/tables.ts` e `routes/og.ts`, e é o que fecha o
 * soft-404 que abriu esta spec: 47 das 88 URLs do sitemap devolviam `200` com
 * "Mesa não encontrada".
 */
export async function loader({ params, request }: LoaderFunctionArgs) {
  const { slug } = params;

  if (!slug) {
    throw data({ message: 'Mesa não encontrada.' }, { status: 404 });
  }

  const res = await fetch(apiUrl(`/api/v1/tables/${encodeURIComponent(slug)}`), {
    signal: request.signal,
    headers: { accept: 'application/json' },
  });

  // `410 Gone` é resposta de sucesso desta rota, não erro: a mesa existiu e
  // saiu do ar, e a tela de encerramento é conteúdo legítimo. O status
  // atravessa para o crawler porque é ele que tira a URL do índice sem fingir
  // que a mesa nunca existiu.
  if (res.status === 410) {
    const json: unknown = await res.json().catch(() => null);
    const payload = json && typeof json === 'object' && 'data' in json
      ? (json as { data: unknown }).data
      : json;
    return data<MesaLoaderData>(
      { kind: 'gone', closed: normalizeClosedTable(payload) },
      { status: 410 },
    );
  }

  if (res.status === 404) {
    throw data({ message: 'Mesa não encontrada.' }, { status: 404 });
  }

  if (!res.ok) {
    // 500/503 do backend não viram 200 com tela de erro: um `200` ensinaria ao
    // índice que esta URL é uma página válida de conteúdo vazio.
    throw data(
      { message: 'Não foi possível carregar esta mesa no momento.' },
      { status: res.status === 503 ? 503 : 500 },
    );
  }

  const json = (await res.json()) as { data?: TableDetail | null };
  const table = json.data ?? null;

  if (!table) {
    throw data({ message: 'Mesa não encontrada.' }, { status: 404 });
  }

  return data<MesaLoaderData>({ kind: 'ok', table });
}

/**
 * Substitui a injeção de meta por regex do `og.ts` (spec 102 T4.2).
 *
 * As tags saem iguais para todo user-agent — é o fim do dynamic rendering, que
 * o próprio Google deixou de recomendar e que produzia a divergência bot↔usuário
 * na origem dos achados B, C e E desta spec.
 */
export function meta({ data: loaderData }: MetaArgs<typeof loader>) {
  return buildTableMeta(loaderData as MesaLoaderData | undefined);
}

export default MesaPage;
