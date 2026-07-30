import { useState, type FormEvent } from 'react';
import toast from 'react-hot-toast';
import { Select } from '@artificio/ui';
import { PainelShell } from '../../components/PainelShell';
import { useMyMaterials } from '../../hooks/useMyMaterials';
import { useCreateSystemSuggestion, useMySystemSuggestions } from '../../hooks/useSystemSuggestions';

const STATUS_LABEL = {
  pending: 'Em análise',
  approved: 'Aprovada',
  rejected: 'Recusada',
} as const;

export function SugestoesSistemaPage() {
  const { data: materials = [] } = useMyMaterials();
  const { data: suggestions = [], isLoading } = useMySystemSuggestions();
  const createMutation = useCreateSystemSuggestion();
  const eligibleMaterials = materials.filter((material) => !material.system_id);
  const [materialId, setMaterialId] = useState('');
  const [rawValue, setRawValue] = useState('');

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    try {
      await createMutation.mutateAsync({ material_id: materialId, raw_value: rawValue.trim() });
      setRawValue('');
      toast.success('Sugestão enviada para análise.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha ao enviar sugestão.');
    }
  }

  const materialTitle = new Map(materials.map((material) => [material.id, material.title]));

  return (
    <PainelShell>
      <h1 className="text-2xl font-bold text-[var(--fg)]">Sugestões de sistema</h1>
      <p className="mt-2 text-sm text-[var(--fg-muted)]">
        Não encontrou o sistema do seu material? Envie o nome usado pela obra e acompanhe a análise aqui.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 flex max-w-xl flex-col gap-4 rounded-md border border-[var(--line)] p-4">
        <label htmlFor="suggestion-material" className="flex flex-col gap-1 text-sm text-[var(--fg-muted)]">
          Material sem sistema
          <Select id="suggestion-material" required value={materialId} onChange={(event) => setMaterialId(event.target.value)}>
            <option value="">Selecione</option>
            {eligibleMaterials.map((material) => <option key={material.id} value={material.id}>{material.title}</option>)}
          </Select>
        </label>
        {eligibleMaterials.length === 0 && (
          <output className="text-sm text-[var(--fg-muted)]">Todos os seus materiais já têm sistema.</output>
        )}
        <label htmlFor="suggestion-name" className="flex flex-col gap-1 text-sm text-[var(--fg-muted)]">
          Nome do sistema{' '}
          <input
            id="suggestion-name"
            required
            maxLength={200}
            value={rawValue}
            onChange={(event) => setRawValue(event.target.value)}
            className="min-h-[44px] rounded-md border border-[var(--line)] bg-transparent px-3 py-2 text-[var(--fg)]"
          />
        </label>
        <button
          type="submit"
          disabled={!materialId || !rawValue.trim() || createMutation.isPending}
          className="min-h-[44px] w-fit rounded-md bg-artificio-orange px-5 py-2 font-semibold text-white disabled:opacity-50"
        >
          {createMutation.isPending ? 'Enviando...' : 'Enviar sugestão'}
        </button>
      </form>

      <h2 className="mt-10 text-lg font-semibold text-[var(--fg)]">Minhas sugestões</h2>
      {isLoading && <p className="mt-3 text-sm text-[var(--fg-muted)]">Carregando...</p>}
      {!isLoading && suggestions.length === 0 && <p className="mt-3 text-sm text-[var(--fg-muted)]">Nenhuma sugestão enviada.</p>}
      <ul className="mt-4 space-y-3">
        {suggestions.map((suggestion) => (
          <li key={suggestion.id} className="rounded-md border border-[var(--line)] p-4">
            <p className="font-semibold text-[var(--fg)]">{suggestion.raw_value}</p>
            <p className="text-sm text-[var(--fg-muted)]">
              {materialTitle.get(suggestion.material_id) ?? 'Material'} · {STATUS_LABEL[suggestion.status]}
            </p>
            {suggestion.rejection_reason && <p className="mt-2 text-sm text-red-600">Motivo: {suggestion.rejection_reason}</p>}
          </li>
        ))}
      </ul>
    </PainelShell>
  );
}
