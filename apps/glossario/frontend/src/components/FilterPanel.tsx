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
        className={`px-4 py-2 rounded-full border-2 transition-all font-bold uppercase text-xs ${activeCategory === null ? 'bg-laranja text-white border-laranja' : 'bg-white text-azul-escuro border-azul-escuro hover:bg-azul-escuro hover:text-white'}`}
      >
        Todas
      </button>
      {categories.map((category) => (
        <button 
          key={category}
          onClick={() => onSelectCategory(category)}
          className={`px-4 py-2 rounded-full border-2 transition-all font-bold uppercase text-xs ${activeCategory === category ? 'bg-laranja text-white border-laranja' : 'bg-white text-azul-escuro border-azul-escuro hover:bg-azul-escuro hover:text-white'}`}
        >
          {category}
        </button>
      ))}
    </div>
  );
};
