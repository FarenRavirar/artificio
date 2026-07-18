interface MetaFieldProps {
  label: string;
  value?: string | number | null;
  className?: string;
}

/**
 * Componente para exibir campos de metadados de forma consistente
 * Renderiza apenas se o valor existir (elimina "Não informado")
 */
export function MetaField({ label, value, className = '' }: MetaFieldProps) {
  if (!value) return null;

  return (
    <div className={`rounded-xl border border-amber-200/15 bg-[var(--surface-input)]/70 p-3 ${className}`}>
      <p className="text-amber-100/80 text-xs uppercase tracking-wide">{label}</p>
      <p className="font-semibold text-white mt-1">{value}</p>
    </div>
  );
}
