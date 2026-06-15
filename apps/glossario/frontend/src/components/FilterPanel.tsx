import React from 'react';

interface FilterPanelProps {
  categories: string[];
  activeCategory: string | null;
  onSelectCategory: (category: string | null) => void;
}

export const FilterPanel: React.FC<FilterPanelProps> = ({ categories, activeCategory, onSelectCategory }) => {
  return (
    <div className="flex flex-wrap gap-2 justify-center mb-6">
      <button 
        onClick={() => onSelectCategory(null)}
        className={`px-4 py-2 rounded-full border-2 transition-all font-bold uppercase text-xs ${activeCategory === null ? 'bg-[var(--artificio-brand)] text-[var(--navy-block-fg)] border-[var(--artificio-brand)]' : 'bg-[var(--surface)] text-[var(--fg)] border-[var(--line)] hover:bg-[var(--navy-block-bg)] hover:text-[var(--navy-block-fg)]'}`}
      >
        Todas
      </button>
      {categories.map((category) => (
        <button 
          key={category}
          onClick={() => onSelectCategory(category)}
          className={`px-4 py-2 rounded-full border-2 transition-all font-bold uppercase text-xs ${activeCategory === category ? 'bg-[var(--artificio-brand)] text-[var(--navy-block-fg)] border-[var(--artificio-brand)]' : 'bg-[var(--surface)] text-[var(--fg)] border-[var(--line)] hover:bg-[var(--navy-block-bg)] hover:text-[var(--navy-block-fg)]'}`}
        >
          {category}
        </button>
      ))}
    </div>
  );
};
