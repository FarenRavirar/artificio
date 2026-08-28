import { useSearchParams } from 'react-router-dom';
import { AdminUsersPanel } from './AdminUsersPanel';
import { PageHeader, SectionCard, tabButtonClass } from './ui';
import { DevFeedbackPanel } from '../dev-feedback/DevFeedbackPanel';

type SystemTab = 'users' | 'feedback';

const TAB_LABEL: Record<SystemTab, string> = {
  users: 'Usuários',
  feedback: 'Erros reportados',
};

function isSystemTab(value: unknown): value is SystemTab {
  return value === 'users' || value === 'feedback';
}

export function SistemaSection() {
  // A aba vem da URL (`?tab=feedback`) porque ela precisa ser ENDEREÇÁVEL: a
  // notificação de feedback técnico (`devFeedback.ts` → `action_url`) leva o
  // admin até aqui, e com a aba em estado local ela caía sempre em "Usuários",
  // escondendo justamente o erro reportado que motivou o clique. Medido no
  // relato de 2026-08-27. Valor da query é externo — `isSystemTab` narrowa e o
  // default continua 'users'.
  const [searchParams, setSearchParams] = useSearchParams();
  const rawTab = searchParams.get('tab');
  const tab: SystemTab = isSystemTab(rawTab) ? rawTab : 'users';

  const setTab = (item: SystemTab) => {
    const next = new URLSearchParams(searchParams);
    next.set('tab', item);
    // `replace`: trocar de aba não é passo de navegação — sem isso o botão
    // "voltar" percorreria cada clique de aba antes de sair da página.
    setSearchParams(next, { replace: true });
  };

  const tabClass = (item: SystemTab) => tabButtonClass(tab === item);

  return (
    <div className="space-y-5">
      <PageHeader
        breadcrumb={['Gestão', 'Sistema']}
        title="Sistema"
        description="Usuários, selo Covil do Lich e feedbacks técnicos reportados."
      />

      <div className="inline-flex flex-wrap rounded-lg border border-[var(--border)] bg-[var(--admin-surface)] p-1">
        {(Object.keys(TAB_LABEL) as SystemTab[]).map((item) => (
          <button key={item} onClick={() => setTab(item)} className={tabClass(item)} aria-pressed={tab === item}>
            {TAB_LABEL[item]}
          </button>
        ))}
      </div>

      <SectionCard title={TAB_LABEL[tab]} bodyClassName="p-5">
        {tab === 'users' && <AdminUsersPanel />}
        {tab === 'feedback' && <DevFeedbackPanel />}
      </SectionCard>
    </div>
  );
}
