import React from 'react';
import { Search } from 'lucide-react';

interface SearchBarProps {
  onSearch: (query: string) => void;
  placeholder?: string;
}

export const SearchBar: React.FC<SearchBarProps> = ({ onSearch, placeholder = "Buscar termo (inglês ou português)..." }) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onSearch(e.target.value);
  };

  return (
    <div className="w-full max-w-2xl mx-auto flex gap-0 group">
      <div className="relative flex-1">
        <input 
          type="text" 
          onChange={handleChange}
          autoFocus
          placeholder={placeholder}
          className="w-full p-4 pl-6 text-lg bg-cinza-fundo border-2 border-r-0 border-azul-escuro rounded-l-md outline-none transition-colors focus:border-laranja placeholder:text-gray-400"
        />
      </div>
      <button 
        type="button"
        className="bg-laranja text-white p-4 px-8 border-2 border-azul-escuro border-l-0 rounded-r-md hover:opacity-90 transition-opacity flex items-center justify-center"
      >
        <Search size={24} strokeWidth={3} />
      </button>
    </div>
  );
};
