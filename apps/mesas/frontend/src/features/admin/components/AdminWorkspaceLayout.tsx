import type { ReactNode } from 'react';
import { PanelRightClose } from 'lucide-react';

interface Props {
  workspace: ReactNode;
  inspector: ReactNode | null;
  onCloseInspector?: () => void;
}

export function AdminWorkspaceLayout({ workspace, inspector, onCloseInspector }: Props) {
  const inspectorOpen = inspector !== null;

  return (
    <div className="flex overflow-hidden" style={{ height: 'calc(100vh - var(--header-height, 0px))' }}>
      <section className="flex-1 min-w-0 overflow-y-auto border-r border-white/10">
        {workspace}
      </section>

      {inspectorOpen && (
        <aside className="w-[400px] shrink-0 overflow-y-auto bg-[#0B1628] relative">
          <button
            onClick={onCloseInspector}
            className="absolute top-4 right-4 p-1 text-white/60 hover:text-white z-10"
            aria-label="Fechar inspector"
          >
            <PanelRightClose size={18} />
          </button>
          {inspector}
        </aside>
      )}
    </div>
  );
}
