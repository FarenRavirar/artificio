import { useContext } from 'react';
import { ProfileContext, type ProfileContextValue } from './profileContextCore';

export function useProfileContext(): ProfileContextValue {
  const context = useContext(ProfileContext);

  if (!context) {
    throw new Error('useProfileContext deve ser usado dentro de um ProfileProvider');
  }

  return context;
}
