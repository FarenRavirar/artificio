import { useState } from 'react';
import { DevFeedbackPanel } from '../../../modules/admin/dev-feedback/DevFeedbackPanel';

type SisSubTab = 'ferramentas' | 'jobs' | 'logs' | 'erros' | 'config';

export function SistemaSection() {
  const [subTab, setSubTab] = useState<SisSubTab>('ferramentas');

  const subTabClass = (tab: SisSubTab) =>
    `px-4 py-2 rounded-lg text-sm font-medium transition-all ${
      subTab === tab
        ? 'bg-blue-600 text-white'
        : 'bg-white/5 text-white/60 hover:bg-white/10'
    }`;

  const stub = (label: string) => (
    <div
      className="rounded-lg p-6 border"
      style={{
        backgroundColor: 'var(--admin-surface, #16223E)',
        borderColor: 'var(--border)',
      }}
    >
      <p className="text-sm" style={{ color: 'var(--fg-faint)' }}>
        {label} — em breve.
      </p>
    </div>
  );

  return (
    <div>
      {/* Subnav local */}
      <div className="flex flex-wrap gap-3 mb-6" role="tablist" aria-label="Subnavegação do Sistema">
        <button onClick={() => setSubTab('ferramentas')} className={subTabClass('ferramentas')} role="tab" aria-selected={subTab === 'ferramentas'}>
          Ferramentas de desenvolvimento
        </button>
        <button onClick={() => setSubTab('jobs')} className={subTabClass('jobs')} role="tab" aria-selected={subTab === 'jobs'}>
          Jobs e filas
        </button>
        <button onClick={() => setSubTab('logs')} className={subTabClass('logs')} role="tab" aria-selected={subTab === 'logs'}>
          Logs
        </button>
        <button onClick={() => setSubTab('erros')} className={subTabClass('erros')} role="tab" aria-selected={subTab === 'erros'}>
          Erros reportados
        </button>
        <button onClick={() => setSubTab('config')} className={subTabClass('config')} role="tab" aria-selected={subTab === 'config'}>
          Configurações
        </button>
      </div>

      {subTab === 'ferramentas' && <DevFeedbackPanel />}
      {subTab === 'jobs' && stub('Jobs e filas')}
      {subTab === 'logs' && stub('Logs')}
      {subTab === 'erros' && stub('Erros reportados')}
      {subTab === 'config' && stub('Configurações')}
    </div>
  );
}
