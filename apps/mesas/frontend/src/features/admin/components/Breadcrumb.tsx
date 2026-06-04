interface Props {
  path: string[];
  creating: boolean;
}

export function Breadcrumb({ path, creating }: Props) {
  return (
    <div className="flex items-center gap-2 text-sm text-white/60">
      {path.map((segment, i) => (
        <span key={i} className="flex items-center gap-2">
          {i > 0 && <span>›</span>}
          <span className={creating && i === path.length - 1 ? 'text-white/40 italic' : ''}>
            {segment}
          </span>
        </span>
      ))}
    </div>
  );
}
