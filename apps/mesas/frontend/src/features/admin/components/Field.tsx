import type { ReactNode } from 'react';

interface Props {
  label: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
}

export function Field({ label, hint, required, children }: Props) {
  return (
    <div>
      <label className="block text-sm font-medium text-white mb-1">
        {label} {required && <span className="text-red-400">*</span>}
      </label>
      {hint && <p className="text-xs text-white/40 mb-2">{hint}</p>}
      {children}
    </div>
  );
}
