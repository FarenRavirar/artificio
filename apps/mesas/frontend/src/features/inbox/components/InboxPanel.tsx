import { useState, useCallback } from 'react';
import { TextPasteArea } from './TextPasteArea';
import { InboxDraftReviewTable } from './InboxDraftReviewTable';

type InboxTab = 'import' | 'drafts';

export function InboxPanel() {
  const [activeTab, setActiveTab] = useState<InboxTab>('import');
  const [draftsKey, setDraftsKey] = useState(0);

  const handleImportSuccess = useCallback(() => {
    setActiveTab('drafts');
    setDraftsKey(prev => prev + 1);
  }, []);

  const tabClass = (tab: InboxTab) =>
    `px-3 py-1.5 text-sm rounded-lg transition-colors ${
      activeTab === tab
        ? 'bg-blue-600 text-white'
        : 'bg-white/5 text-white/60 hover:bg-white/10'
    }`;

  return (
    <div>
      <div className="flex gap-2 mb-4">
        <button className={tabClass('import')} onClick={() => setActiveTab('import')}>
          Importar
        </button>
        <button className={tabClass('drafts')} onClick={() => setActiveTab('drafts')}>
          Drafts
        </button>
      </div>

      {activeTab === 'import' ? (
        <TextPasteArea onImportSuccess={handleImportSuccess} />
      ) : (
        <InboxDraftReviewTable key={draftsKey} />
      )}
    </div>
  );
}
