export function StepActions({
  step,
  setStep,
  canNext,
  errorMessage,
  onSubmit,
  loading,
}: {
  step: number;
  setStep: (n: number) => void;
  canNext: boolean;
  errorMessage?: string | null;
  onSubmit: () => void;
  loading?: boolean;
}) {
  return (
    <div className="space-y-3 pt-6">
      {errorMessage && (
        <div className="p-3 bg-red-900/40 border border-red-700/50 rounded-xl text-red-300 text-sm">
          ⚠️ {errorMessage}
        </div>
      )}

      <div className="flex justify-between items-center">
        {step > 1 ? (
          <button
            type="button"
            onClick={() => setStep(step - 1)}
            className="px-4 py-2 rounded-xl border border-white/20 hover:border-white/40 text-white transition-colors"
          >
            ← Voltar
          </button>
        ) : (
          <div />
        )}

        {step < 6 ? (
          <button
            type="button"
            disabled={!canNext}
            onClick={() => setStep(step + 1)}
            className={`px-6 py-3 rounded-xl font-semibold transition-all ${
              canNext
                ? 'bg-[var(--color-artificio-orange)] hover:bg-[var(--color-artificio-orange-hover)] text-white cursor-pointer'
                : 'bg-white/10 text-white/40 cursor-not-allowed'
            }`}
          >
            {canNext ? 'Continuar →' : 'Preencha os campos obrigatórios'}
          </button>
        ) : (
          <button
            type="button"
            onClick={onSubmit}
            disabled={loading}
            className="px-6 py-3 rounded-xl font-bold bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white transition-colors"
          >
            {loading ? 'Publicando...' : '✓ Publicar Mesa'}
          </button>
        )}
      </div>
    </div>
  );
}
