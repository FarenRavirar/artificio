import { useState } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { SystemsAdminView } from '../../../pages/SystemsAdminView';
import { ScenariosAdminView } from '../../../pages/ScenariosAdminView';
import { PlatformsPage } from '../platforms/PlatformsPage';
import { PageHeader, SectionCard, tabButtonClass } from './ui';
import { SettingSuggestionsPanel } from './SettingSuggestionsPanel';

type CatalogTab = 'systems' | 'platforms' | 'scenarios' | 'setting-styles';
type PlatformKind = 'vtt' | 'communication';

const TAB_LABEL: Record<CatalogTab, string> = {
  systems: 'Sistemas',
  platforms: 'Plataformas',
  scenarios: 'Cenários',
  'setting-styles': 'Estilos por cenário',
};

// Derivado de TAB_LABEL, não lista paralela: aba nova entrava num só dos dois
// lugares e o deep-link `?tab=` caía silenciosamente na primeira aba.
// Achado real (review PR #280, coderabbit, nitpick).
const TAB_VALUES: ReadonlySet<CatalogTab> = new Set(Object.keys(TAB_LABEL) as CatalogTab[]);

export function ConteudoSection() {
  const [urlParams] = useSearchParams();
  const tabFromUrl = urlParams.get('tab');
  const initialTab: CatalogTab = TAB_VALUES.has(tabFromUrl as CatalogTab) ? (tabFromUrl as CatalogTab) : 'systems';
  const [tab, setTab] = useState<CatalogTab>(initialTab);
  const [platformKind, setPlatformKind] = useState<PlatformKind>('vtt');

  // R6 (spec 093): a aba "Mesas" migrou para /gestao/mesas/mesas. Link antigo
  // /gestao/catalogo?tab=tables não pode cair silenciosamente na primeira aba.
  // O early return fica DEPOIS dos hooks — antes deles quebra react-hooks/rules-of-hooks.
  if (tabFromUrl === 'tables') {
    return <Navigate to="/gestao/mesas/mesas" replace />;
  }

  const tabClass = (item: CatalogTab) => tabButtonClass(tab === item);

  return (
    <div className="space-y-5">
      <PageHeader
        breadcrumb={['Gestão', 'Catálogo']}
        title="Catálogo"
        description="Sistemas, plataformas, cenários e estilos auxiliares."
      />

      <div className="inline-flex flex-wrap rounded-lg border border-[var(--border)] bg-[var(--admin-surface)] p-1">
        {(Object.keys(TAB_LABEL) as CatalogTab[]).map((item) => (
          <button key={item} onClick={() => setTab(item)} className={tabClass(item)} aria-pressed={tab === item}>
            {TAB_LABEL[item]}
          </button>
        ))}
      </div>

      <SectionCard title={TAB_LABEL[tab]} bodyClassName="p-5">
        {tab === 'systems' && <SystemsAdminView />}

        {tab === 'platforms' && (
          <div className="space-y-4">
            <div className="inline-flex rounded-lg border border-[var(--border)] bg-[var(--admin-surface)] p-1">
              <button onClick={() => setPlatformKind('vtt')} className={platformKind === 'vtt' ? tabClass('platforms') : 'rounded-md px-3 py-2 text-sm text-[var(--fg-low)] hover:bg-[var(--admin-hover)]'}>
                VTTs
              </button>
              <button onClick={() => setPlatformKind('communication')} className={platformKind === 'communication' ? tabClass('platforms') : 'rounded-md px-3 py-2 text-sm text-[var(--fg-low)] hover:bg-[var(--admin-hover)]'}>
                Comunicação
              </button>
            </div>
            <PlatformsPage key={platformKind} initialKind={platformKind} />
          </div>
        )}

        {tab === 'scenarios' && <ScenariosAdminView />}

        {tab === 'setting-styles' && <SettingSuggestionsPanel />}
      </SectionCard>
    </div>
  );
}
