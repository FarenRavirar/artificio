import { createElement } from 'react';
import { linkTypeIcon } from '../utils/linkTypes';

/**
 * Ícone do tipo de link. Componente próprio (e não `const Icon = ...` no corpo
 * de quem renderiza) para o React ver um tipo de elemento estável entre renders
 * — regra `react-hooks/static-components`.
 */
export function LinkTypeIcon({ type, className }: Readonly<{ type: string; className?: string }>) {
  return createElement(linkTypeIcon(type), { className, 'aria-hidden': true });
}
