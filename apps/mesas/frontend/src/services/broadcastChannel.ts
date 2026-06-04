import { queryClient } from '../lib/queryClient';

/**
 * BroadcastChannel para sincronização entre abas
 * Com fallback para localStorage em browsers antigos
 */

const STORAGE_KEY = 'profile_sync_fallback';
let channel: BroadcastChannel | null = null;

// Tentar usar BroadcastChannel nativo
if (typeof BroadcastChannel !== 'undefined') {
  channel = new BroadcastChannel('profile_sync');
  
  channel.onmessage = (event) => {
    if (event.data.type === 'PROFILE_UPDATED') {
      console.log('[BroadcastChannel] Perfil atualizado em outra aba, revalidando...');
      queryClient.invalidateQueries({ queryKey: ['profile', 'me'] });
    }
  };
} else {
  // Fallback: localStorage
  console.warn('[BroadcastChannel] Não suportado, usando fallback localStorage');
  
  window.addEventListener('storage', (event) => {
    if (event.key === STORAGE_KEY && event.newValue) {
      console.log('[localStorage] Perfil atualizado em outra aba, revalidando...');
      queryClient.invalidateQueries({ queryKey: ['profile', 'me'] });
    }
  });
}

/**
 * Notifica outras abas sobre atualização de perfil
 */
export function notifyProfileUpdate(): void {
  if (channel) {
    // BroadcastChannel nativo
    channel.postMessage({ type: 'PROFILE_UPDATED', timestamp: Date.now() });
  } else {
    // Fallback: localStorage
    localStorage.setItem(STORAGE_KEY, Date.now().toString());
    // Limpar após 100ms para permitir nova notificação
    setTimeout(() => localStorage.removeItem(STORAGE_KEY), 100);
  }
}

/**
 * Cleanup ao desmontar
 */
export function closeBroadcastChannel(): void {
  channel?.close();
}
