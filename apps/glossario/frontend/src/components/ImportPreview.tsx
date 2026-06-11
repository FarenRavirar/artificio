import React from 'react';
import { CheckCircle2, PlusCircle, Users, ChevronRight } from 'lucide-react';

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export type ImportAction = 'insert' | 'update_own' | 'duplicate' | 'override';

export interface PreviewRow {
  action:          ImportAction;
  name_en:         string;
  name_pt:         string;
  system_name?:    string;
  category_name?:  string;
  subcategory_name?: string;
  changed_fields?: string[];  // Apenas para update_own
}

interface ImportPreviewProps {
  rows:            PreviewRow[];
  onConfirm:       () => void;
  onCancel:        () => void;
  isLoading:       boolean;
}

// ---------------------------------------------------------------------------
// Helpers de hierarquia / label de ação
// ---------------------------------------------------------------------------

const FIELD_LABEL: Record<string, string> = {
  name_pt:        'Nome PT',
  nucleus:        'Núcleo',
  book_reference: 'Livro',
  page_reference: 'Página',
  additional_info: 'Informações',
  category_id:    'Categoria',
};

const actionMeta: Record<ImportAction, { label: string; color: string; icon: React.ReactNode }> = {
  insert:     { label: 'Novo',          color: 'bg-green-50 border-green-200 text-green-800',  icon: <PlusCircle   size={12} className="text-green-600"  /> },
  update_own: { label: 'Atualização',   color: 'bg-blue-50  border-blue-200  text-blue-800',   icon: <CheckCircle2 size={12} className="text-blue-600"   /> },
  override:   { label: 'Override',      color: 'bg-cyan-50 border-cyan-200 text-cyan-800', icon: <CheckCircle2 size={12} className="text-cyan-600" /> },
  duplicate:  { label: 'Duplicata',     color: 'bg-amber-50 border-amber-200 text-amber-800',  icon: <Users        size={12} className="text-amber-600"  /> },
};

// ---------------------------------------------------------------------------
// Componente de linha de preview
// ---------------------------------------------------------------------------

const PreviewRow: React.FC<{ row: PreviewRow }> = ({ row }) => {
  const meta = actionMeta[row.action];
  return (
    <div className={`flex items-start gap-3 px-4 py-3 rounded-lg border ${meta.color}`}>
      <span className="mt-0.5 shrink-0">{meta.icon}</span>
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-bold text-xs uppercase tracking-wider">{row.name_en}</span>
          {row.system_name && (
            <span className="text-[10px] opacity-70 italic">{row.system_name}</span>
          )}
          {row.category_name && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/60 border border-current/20">
              CAT: {row.category_name}
            </span>
          )}
          {row.subcategory_name && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/60 border border-current/20">
              SUB: {row.subcategory_name}
            </span>
          )}
        </div>
        <div className="text-[11px] opacity-80 mt-0.5">{row.name_pt}</div>
        {row.action === 'update_own' && row.changed_fields && row.changed_fields.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {row.changed_fields.map(f => (
              <span key={f} className="text-[10px] px-1.5 py-0.5 rounded bg-white/60 border border-blue-200 text-blue-700">
                {FIELD_LABEL[f] ?? f}
              </span>
            ))}
          </div>
        )}
        {row.action === 'duplicate' && (
          <p className="text-[10px] mt-1 opacity-70">
            Já existe um termo com este nome de outro autor. Será inserido como sugestão pendente.
          </p>
        )}
        {row.action === 'override' && (
          <p className="text-[10px] mt-1 opacity-70">
            Termo existente de outro autor será atualizado por privilégio administrativo.
          </p>
        )}
      </div>
      <span className={`shrink-0 text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded border ${meta.color}`}>
        {meta.label}
      </span>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------

const ImportPreview: React.FC<ImportPreviewProps> = ({ rows, onConfirm, onCancel, isLoading }) => {
  const inserts    = rows.filter(r => r.action === 'insert');
  const updates    = rows.filter(r => r.action === 'update_own');
  const overrides  = rows.filter(r => r.action === 'override');
  const duplicates = rows.filter(r => r.action === 'duplicate');

  const Section: React.FC<{ title: string; count: number; children: React.ReactNode; accent: string }> =
    ({ title, count, children, accent }) => (
      count > 0 ? (
        <div className="space-y-2">
          <div className={`flex items-center gap-2 text-xs font-black uppercase tracking-widest ${accent}`}>
            <ChevronRight size={14} />
            {title}
            <span className="ml-auto font-mono bg-white px-2 py-0.5 rounded-full border text-gray-500 text-[10px]">{count}</span>
          </div>
          <div className="space-y-1.5">{children}</div>
        </div>
      ) : null
    );

  return (
    <div className="space-y-5">
      {/* Resumo */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
        {[
          { label: 'Novos',       value: inserts.length,    color: 'text-green-600' },
          { label: 'Atualizações',value: updates.length,    color: 'text-blue-600'  },
          { label: 'Override',    value: overrides.length,  color: 'text-purple-600' },
          { label: 'Duplicatas',  value: duplicates.length, color: 'text-amber-600' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-gray-50 rounded-xl p-3 border border-gray-100">
            <p className={`text-2xl font-black ${color}`}>{value}</p>
            <p className="text-[10px] text-gray-500 uppercase tracking-widest mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Listas por grupo */}
      <div className="space-y-4 max-h-[420px] overflow-y-auto pr-1 custom-scrollbar">
        <Section title="Novos termos" count={inserts.length} accent="text-green-700">
          {inserts.map((r, i) => <PreviewRow key={i} row={r} />)}
        </Section>
        <Section title="Atualizações (seus termos)" count={updates.length} accent="text-blue-700">
          {updates.map((r, i) => <PreviewRow key={i} row={r} />)}
        </Section>
        <Section title="Overrides administrativos" count={overrides.length} accent="text-cyan-700">
          {overrides.map((r, i) => <PreviewRow key={i} row={r} />)}
        </Section>
        <Section title="Duplicatas de outros autores" count={duplicates.length} accent="text-amber-700">
          {duplicates.map((r, i) => <PreviewRow key={i} row={r} />)}
        </Section>
      </div>

      {/* Ações */}
      <div className="flex items-center justify-end gap-3 pt-2 border-t border-gray-100">
        <button
          type="button"
          onClick={onCancel}
          disabled={isLoading}
          className="px-4 py-2 rounded-lg border border-gray-300 text-gray-600 text-xs font-bold uppercase tracking-wide hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={isLoading || rows.length === 0}
          className="flex items-center gap-2 px-5 py-2 rounded-lg bg-azul-escuro text-white text-xs font-bold uppercase tracking-wide hover:bg-black transition-colors disabled:opacity-50"
        >
          {isLoading ? 'Importando...' : `Confirmar importação (${rows.length} termos)`}
        </button>
      </div>
    </div>
  );
};

export default ImportPreview;
