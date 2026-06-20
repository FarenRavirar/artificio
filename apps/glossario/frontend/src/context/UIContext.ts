import { createContext, useContext } from 'react';

// Contexto para abrir o modal de sugestão de qualquer componente.
// Arquivo separado do App.tsx por causa do react-refresh (só componentes podem
// ser exportados de arquivos de componente).
export const UIContext = createContext<{ openAddTerm: () => void }>({ openAddTerm: () => {} });
export const useUI = () => useContext(UIContext);
