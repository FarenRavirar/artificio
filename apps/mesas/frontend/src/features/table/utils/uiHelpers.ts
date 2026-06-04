import type { CTAConfig } from '../types/tableView.types';

/**
 * Retorna classes CSS para botões baseado no variant do CTA
 */
export function getButtonStyle(variant: CTAConfig['variant']): string {
  switch (variant) {
    case 'primary':
      return 'bg-[var(--color-artificio-orange)] hover:bg-[var(--color-artificio-orange-hover)] text-white transition transform hover:scale-[1.02] active:scale-[0.98]';
    case 'secondary':
      return 'bg-white/10 hover:bg-white/20 text-white transition transform hover:scale-[1.02] active:scale-[0.98]';
    case 'disabled':
      return 'bg-white/5 text-white/50 cursor-not-allowed';
  }
}

/**
 * Retorna classes CSS para urgência baseado no tom
 */
export function getUrgencyColor(tone: 'critical' | 'high' | 'medium' | 'low' | 'none'): string {
  switch (tone) {
    case 'critical':
      return 'text-red-400';
    case 'high':
      return 'text-orange-400';
    case 'medium':
      return 'text-yellow-400';
    case 'low':
      return 'text-white/70';
    case 'none':
      return 'text-white/50';
  }
}

/**
 * Handler para ações de CTA
 */
export function handleCTA(cta: CTAConfig): void {
  if (cta.action === 'external-link' && cta.actionUrl) {
    // Tracking de clique antes de abrir link
    if (typeof window !== 'undefined') {
      const slug = window.location.pathname.split('/').pop();
      if (slug) {
        fetch(`/api/v1/tables/${slug}/click`, { method: 'POST' }).catch(() => {
          // Silencioso - tracking não deve quebrar UX
        });
      }
    }
    
    window.open(cta.actionUrl, '_blank', 'noopener,noreferrer');
    return;
  }

  if (cta.action === 'scroll-contact') {
    const el = document.getElementById('mesa-contato');
    if (!el) return;

    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.add('ring-2', 'ring-orange-400', 'ring-offset-2', 'ring-offset-[#091427]');
    
    setTimeout(() => {
      el.classList.remove('ring-2', 'ring-orange-400', 'ring-offset-2', 'ring-offset-[#091427]');
    }, 1500);
  }
}

/**
 * Handler para alterar status da mesa
 */
export async function handleStatus(id: string, status: string): Promise<void> {
  const statusLabels: Record<string, string> = {
    active: 'ativar',
    cancelled: 'desativar',
    full: 'marcar como lotada',
    ended: 'marcar como encerrada',
  };

  const label = statusLabels[status] || status;
  
  if (!confirm(`Tem certeza que deseja ${label} esta mesa?`)) {
    return;
  }

  try {
    const res = await fetch(`/api/v1/gm/tables/${id}/status`, {
      method: 'PATCH',
      headers: { 
        'Content-Type': 'application/json',
      },
      credentials: 'include', // Usa cookie HTTP-only ao invés de Bearer token
      body: JSON.stringify({ status }),
    });

    if (!res.ok) {
      const error = await res.json();
      alert(error.error || 'Erro ao alterar status.');
      return;
    }

    window.location.reload();
  } catch {
    alert('Erro ao alterar status. Tente novamente.');
  }
}

/**
 * Handler para editar mesa
 * Navega para /painel?edit=<id> — rota tratada por PainelMestrePage via searchParams
 */
export function handleEdit(id: string): void {
  window.location.href = `/painel?edit=${id}`;
}
