import { useState } from 'react';
import { AdminUsersPanel } from './AdminUsersPanel';
import { PageHeader, SectionCard } from './ui';
import { DevFeedbackPanel } from '../dev-feedback/DevFeedbackPanel';

type SystemTab = 'users' | 'feedback';

const TAB_LABEL: Record<SystemTab, string> = {
  users: 'Usuários',
  feedback: 'Erros reportados',
};

export function SistemaSection() {
  const [tab, setTab] = useState<SystemTab>('users');

  const tabClass = (item: SystemTab) =>
    `rounded-md px-3 py-2 text-sm font-medium transition-colors ${
      tab === item
        ? 'bg-[var(--admin-hover)] text-[var(--fg)]'
        : 'text-[var(--fg-low)] hover:bg-[var(--admin-hover)] hover:text-[var(--fg)]'
    }`;

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
