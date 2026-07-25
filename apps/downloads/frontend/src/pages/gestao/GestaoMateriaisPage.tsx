import { useNavigate } from 'react-router-dom';
import { AdminTable, PageHeader, StatusPill, type AdminColumn } from '@artificio/ui/admin';
import { GestaoShell } from '../../components/GestaoShell';
import { useMaterialsCatalog } from '../../hooks/useMaterialsCatalog';

const STATE_LABEL: Record<string, string> = {
  draft: 'Rascunho',
  in_review: 'Em revisão',
  published: 'Publicado',
  rejected: 'Rejeitado',
  withdrawn: 'Retirado',
};

const STATE_TONE: Record<string, 'neutral' | 'brand' | 'success' | 'warn' | 'danger'> = {
  draft: 'neutral',
  in_review: 'warn',
  published: 'success',
  rejected: 'danger',
  withdrawn: 'neutral',
};

interface MaterialRow {
  id: string;
  title: string;
  editorial_state: string;
}

// T1.1 (spec 075) — visao geral de materiais publicados (busca/lista ja
// existente na 073, aqui reusada no contexto admin); auditoria por item
// aponta pra /gestao/auditoria/:id. Fase 5C (spec 086): reconstruida sobre
// PageHeader/AdminTable/StatusPill do kit compartilhado (T5C.5).
export function GestaoMateriaisPage() {
  const { data, isLoading } = useMaterialsCatalog({});
  const navigate = useNavigate();

  const columns: Array<AdminColumn<MaterialRow>> = [
    { key: 'title', header: 'Título', render: (row) => row.title },
    {
      key: 'editorial_state',
      header: 'Estado',
      render: (row) => (
        <StatusPill tone={STATE_TONE[row.editorial_state] ?? 'neutral'}>
          {STATE_LABEL[row.editorial_state] ?? row.editorial_state}
        </StatusPill>
      ),
    },
  ];

  return (
    <GestaoShell>
      <PageHeader title="Materiais" />

      <div className="mt-6">
        <AdminTable<MaterialRow>
          tableId="gestao-materiais"
          rows={data?.items ?? []}
          getRowId={(row) => row.id}
          columns={columns}
          searchKeys={['title']}
          loading={isLoading}
          rowActions={[{ key: 'auditoria', label: 'Auditoria', onRun: (row) => navigate(`/gestao/auditoria/${row.id}`) }]}
          emptyTitle="Nenhum material encontrado"
        />
      </div>
    </GestaoShell>
  );
}
