import { useParams } from 'react-router-dom';
import { GestaoShell } from '../../components/GestaoShell';
import { useMaterialHistory } from '../../hooks/useMaterialHistory';
import { useAdminLinkHistory } from '../../hooks/useAdminLinkHistory';

// T3.1/T3.2 (spec 075) — auditoria completa: quem editou, quando,
// valor antigo->novo por campo, incluindo TODO historico de links (nao so o
// atual). Criterio de aceite 4.
export function GestaoAuditoriaPage() {
  const { materialId } = useParams<{ materialId: string }>();
  const { data: history, isLoading } = useMaterialHistory(materialId);
  const { data: linkHistory } = useAdminLinkHistory(materialId);

  if (!materialId) {
    return (
      <GestaoShell>
        <h1 className="text-2xl font-bold text-[var(--fg)]">Auditoria de edição</h1>
        <p className="mt-4 text-[var(--fg-muted)]">Selecione um material para ver o histórico de auditoria.</p>
      </GestaoShell>
    );
  }

  return (
    <GestaoShell>
      <h1 className="text-2xl font-bold text-[var(--fg)]">Auditoria de edição</h1>

      {isLoading && <p className="mt-4 text-[var(--fg-muted)]">Carregando...</p>}

      <section className="mt-6">
        <h2 className="text-lg font-semibold text-[var(--fg)]">Histórico completo por campo</h2>
        <ul className="mt-2 divide-y divide-[var(--line)]">
          {history?.map((version) => (
            <li key={version.id} className="py-3 text-sm text-[var(--fg-muted)]">
              <p>
                <span className="font-semibold">{version.field_name}</span>: "{version.old_value ?? '(vazio)'}" →{' '}
                "{version.new_value ?? '(vazio)'}"
              </p>
              <p className="text-xs text-[var(--fg-muted)]">
                por {version.changed_by} em {new Date(version.changed_at).toLocaleString('pt-BR')}
              </p>
            </li>
          ))}
          {history && history.length === 0 && <p className="py-3 text-[var(--fg-muted)]">Sem histórico registrado.</p>}
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-[var(--fg)]">Todos os links já usados</h2>
        <ul className="mt-2 divide-y divide-[var(--line)]">
          {linkHistory?.map((version) => (
            <li key={version.id} className="py-3 text-sm text-[var(--fg-muted)]">
              <p>"{version.old_value ?? '(vazio)'}" → "{version.new_value ?? '(vazio)'}"</p>
              <p className="text-xs text-[var(--fg-muted)]">
                por {version.changed_by} em {new Date(version.changed_at).toLocaleString('pt-BR')}
              </p>
            </li>
          ))}
          {linkHistory?.length === 0 && <p className="py-3 text-[var(--fg-muted)]">Nenhuma troca de link registrada.</p>}
        </ul>
      </section>
    </GestaoShell>
  );
}
