interface Props { 
  tables: number; 
  children: number; 
  aliases: number; 
}

export function EntityCounters({ tables, children, aliases }: Props) {
  if (tables === 0 && children === 0 && aliases === 0) return null;
  return (
    <span className="shrink-0 flex items-center gap-2 text-xs text-white/40 font-mono tabular-nums">
      {tables > 0 && <span title={`${tables} mesas`}>{tables}m</span>}
      {children > 0 && <span title={`${children} filhos`}>{children}f</span>}
      {aliases > 0 && <span title={`${aliases} aliases`}>{aliases}a</span>}
    </span>
  );
}
