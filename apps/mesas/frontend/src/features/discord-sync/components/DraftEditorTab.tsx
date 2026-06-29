import type { ChangeEvent } from 'react';
import type { DraftForm, DraftTableType, DraftModality, DraftPriceType, DraftFrequency, DraftDayOfWeek } from '../draftFormUtils';
import type { DiscordSlotsAmbiguity } from '../types';
import type { SystemTreeNode } from '../../../types/systems';

interface DraftEditorTabProps {
  form: DraftForm;
  missingFields: string[];
  systems: SystemTreeNode[];
  systemsLoading: boolean;
  coverPreviewUrl: string;
  coverError: string | null;
  coverUploading: boolean;
  coverInputRef: React.RefObject<HTMLInputElement | null>;
  shouldShowSlotsDisambiguation: boolean;
  slotsAmbiguity: DiscordSlotsAmbiguity | null;
  slotsInterpretation: 'filled_total' | 'open_total';
  savingFields: boolean;
  onUpdateForm: <K extends keyof DraftForm>(key: K, value: DraftForm[K]) => void;
  onSystemChange: (systemId: string) => void;
  onCoverUpload: (event: ChangeEvent<HTMLInputElement>) => void;
  onRemoveCover: () => void;
  onSetSlotsInterpretation: (v: 'filled_total' | 'open_total') => void;
  onConfirmSlots: () => void;
}

const inputClass = 'w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-white/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-400';
const labelClass = 'block text-white/60 text-xs mb-1';

export function DraftEditorTab({
  form, missingFields, systems, systemsLoading,
  coverPreviewUrl, coverError, coverUploading, coverInputRef,
  shouldShowSlotsDisambiguation, slotsAmbiguity, slotsInterpretation, savingFields,
  onUpdateForm, onSystemChange, onCoverUpload, onRemoveCover,
  onSetSlotsInterpretation, onConfirmSlots,
}: Readonly<DraftEditorTabProps>) {
  return (
    <div className="space-y-4">
      {missingFields.length > 0 && (
        <div className="rounded-lg border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-amber-100 text-sm" role="alert" aria-live="assertive">
          Campos pendentes: {missingFields.join(', ')}
        </div>
      )}

      <div className="rounded-lg border border-white/10 bg-white/5 p-3">
        <div className="flex items-start gap-3">
          <div className="h-24 w-40 shrink-0 overflow-hidden rounded-lg border border-white/10 bg-black/30">
            {coverPreviewUrl ? (
              <img src={coverPreviewUrl} alt="Capa do draft" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xs text-white/30">Sem capa</div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex items-center gap-2">
              <span className="text-sm font-medium text-white">Capa</span>
              {form.cover_quality === 'low' && <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-xs text-amber-200">baixa resolução</span>}
            </div>
            <p className="truncate text-xs text-white/50">{coverPreviewUrl || 'Nenhuma imagem associada.'}</p>
            {coverError && <p className="mt-1 text-xs text-red-300" role="alert">{coverError}</p>}
            <div className="mt-3 flex flex-wrap gap-2">
              <input ref={coverInputRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={onCoverUpload} className="hidden" />
              <button type="button" onClick={() => coverInputRef.current?.click()} disabled={coverUploading} className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white text-xs rounded-lg transition-colors disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-400">
                {coverUploading ? 'Enviando...' : 'Substituir'}
              </button>
              {coverPreviewUrl && (
                <button type="button" onClick={onRemoveCover} className="px-3 py-1.5 bg-red-500/15 hover:bg-red-500/25 text-red-100 text-xs rounded-lg transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-400">
                  Remover
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {shouldShowSlotsDisambiguation && slotsAmbiguity && (
        <div className="rounded-lg border border-amber-400/30 bg-amber-500/10 p-4 text-sm text-amber-50">
          <p className="font-medium">Como interpretar {slotsAmbiguity.first}/{slotsAmbiguity.second} deste post?</p>
          <div className="mt-3 space-y-2">
            <label className="flex items-center gap-2">
              <input type="radio" name="slots-interpretation" checked={slotsInterpretation === 'filled_total'} onChange={() => onSetSlotsInterpretation('filled_total')} className="accent-amber-400" />
              <span>{slotsAmbiguity.first} inscritos / {Math.max(slotsAmbiguity.first, slotsAmbiguity.second)} total</span>
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" name="slots-interpretation" checked={slotsInterpretation === 'open_total'} onChange={() => onSetSlotsInterpretation('open_total')} className="accent-amber-400" />
              <span>{slotsAmbiguity.first} disponíveis / {Math.max(slotsAmbiguity.first, slotsAmbiguity.second)} máximo</span>
            </label>
          </div>
          <button type="button" onClick={onConfirmSlots} disabled={savingFields} className="mt-3 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-medium rounded-lg transition-colors disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-400">
            Confirmar
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <label>
          <span className={labelClass}>Título</span>
          <input value={form.title} onChange={(e) => onUpdateForm('title', e.target.value)} className={inputClass} />
        </label>
        <label>
          <span className={labelClass}>Sistema</span>
          <select value={form.system_id} onChange={(e) => onSystemChange(e.target.value)} className="app-select w-full">
            <option value="">{systemsLoading ? 'Carregando sistemas...' : 'Selecione um sistema'}</option>
            {systems.map((system) => (
              <option key={system.id} value={system.id}>{system.name_pt || system.name}</option>
            ))}
          </select>
        </label>
        <label>
          <span className={labelClass}>Tipo</span>
          <select value={form.type} onChange={(e) => onUpdateForm('type', e.target.value as DraftTableType)} className="app-select w-full">
            <option value="campanha">Campanha</option>
            <option value="one-shot">One-shot</option>
            <option value="oneshot-serie">Série de one-shots</option>
            <option value="aberta">Aberta</option>
          </select>
        </label>
        <label>
          <span className={labelClass}>Modalidade</span>
          <select value={form.modality} onChange={(e) => onUpdateForm('modality', e.target.value as DraftModality)} className="app-select w-full">
            <option value="online">Online</option>
            <option value="presencial">Presencial</option>
            <option value="hibrida">Híbrida</option>
          </select>
        </label>
        <label>
          <span className={labelClass}>Preço</span>
          <select value={form.price_type} onChange={(e) => onUpdateForm('price_type', e.target.value as DraftPriceType)} className="app-select w-full">
            <option value="gratuita">Gratuita</option>
            <option value="paga">Paga</option>
          </select>
        </label>
        <label>
          <span className={labelClass}>Valor</span>
          <input value={form.price_value} onChange={(e) => onUpdateForm('price_value', e.target.value)} className={inputClass} placeholder="0" disabled={form.price_type === 'gratuita'} />
        </label>
        <label>
          <span className={labelClass}>Vagas totais</span>
          <input value={form.slots_total} onChange={(e) => onUpdateForm('slots_total', e.target.value)} className={inputClass} inputMode="numeric" />
        </label>
        <label>
          <span className={labelClass}>Vagas abertas</span>
          <input value={form.slots_open} onChange={(e) => onUpdateForm('slots_open', e.target.value)} className={inputClass} inputMode="numeric" />
        </label>
        <label>
          <span className={labelClass}>Dia</span>
          <select value={form.day_of_week} onChange={(e) => onUpdateForm('day_of_week', e.target.value as DraftDayOfWeek)} className="app-select w-full">
            <option value="">Selecione</option>
            <option value="segunda">Segunda</option>
            <option value="terça">Terça</option>
            <option value="quarta">Quarta</option>
            <option value="quinta">Quinta</option>
            <option value="sexta">Sexta</option>
            <option value="sábado">Sábado</option>
            <option value="domingo">Domingo</option>
          </select>
        </label>
        <label>
          <span className={labelClass}>Horário</span>
          <input value={form.start_time} onChange={(e) => onUpdateForm('start_time', e.target.value)} className={inputClass} placeholder="19:00" />
        </label>
        <label>
          <span className={labelClass}>Frequência</span>
          <select value={form.frequency} onChange={(e) => onUpdateForm('frequency', e.target.value as DraftFrequency)} className="app-select w-full">
            <option value="semanal">Semanal</option>
            <option value="quinzenal">Quinzenal</option>
            <option value="mensal">Mensal</option>
            <option value="avulsa">Única</option>
            <option value="outra">Outra</option>
          </select>
        </label>
        <label>
          <span className={labelClass}>Contato Discord</span>
          <input value={form.contact_discord} onChange={(e) => onUpdateForm('contact_discord', e.target.value)} className={inputClass} />
        </label>
        <label className="md:col-span-2">
          <span className={labelClass}>Link de inscrição/contato</span>
          <input value={form.contact_url} onChange={(e) => onUpdateForm('contact_url', e.target.value)} className={inputClass} />
        </label>
        <label className="md:col-span-2">
          <span className={labelClass}>Descrição</span>
          <textarea value={form.description} onChange={(e) => onUpdateForm('description', e.target.value)} className={`${inputClass} min-h-28 resize-y`} />
        </label>
      </div>
    </div>
  );
}
