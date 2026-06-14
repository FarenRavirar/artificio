import { useState } from 'react';
import toast from 'react-hot-toast';
import type { TableViewModel, TableActionPanelVariant } from '../types/tableView.types';
import { InlineDeleteConfirmation } from '../../../components/InlineDeleteConfirmation';
import { getButtonStyle, getUrgencyColor, handleCTA, handleEdit, handleStatus, handleArchive } from '../utils/uiHelpers';
import { TableContactsBlock } from './TableContactsBlock';
import { useTracking } from '../../../hooks/useTracking';

interface TableActionPanelProps {
  vm: TableViewModel;
  variant?: TableActionPanelVariant;
  deleteEndpointScope?: 'gm' | 'admin';
}

/**
 * Action Panel - Motor de decisão
 * Ordem fixa: CTA → Urgência → Preço → Info → Contato
 * Reutilizável em: MesaPage, Painel do Mestre, Card expandido
 */
export function TableActionPanel({ vm, variant = 'full', deleteEndpointScope = 'gm' }: TableActionPanelProps) {
  const { trackTableClick } = useTracking();
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteTable = async () => {
    if (isDeleting) return;

    setIsDeleting(true);
    try {
      const deleteEndpoint = deleteEndpointScope === 'admin'
        ? `/api/v1/admin/tables/${vm.id}`
        : `/api/v1/gm/tables/${vm.id}`;

      const res = await fetch(deleteEndpoint, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      if (!res.ok) {
        const error = await res.json().catch(() => null) as { error?: string } | null;
        toast.error(error?.error || 'Erro ao excluir mesa.');
        return;
      }

      toast.success('Mesa excluida com sucesso.');
      window.location.href = deleteEndpointScope === 'admin' ? '/gestao' : '/painel';
    } catch {
      toast.error('Erro ao excluir mesa. Tente novamente.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Modo owner: gestão + preview completo (como visitante vê)
  if (variant === 'owner') {
    return (
      <aside className="space-y-4">
        {/* Gestão */}
        <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-2">
          <p className="text-xs font-semibold text-white/60 uppercase tracking-wide mb-3">
            Gerenciamento
          </p>

          <button
            onClick={() => handleEdit(vm.id)}
            className="w-full py-2 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 text-sm font-medium transition"
          >
            ✏️ Editar mesa
          </button>

          {vm.status !== 'cancelled' && (
            <button
              onClick={() => handleStatus(vm.id, 'cancelled')}
              className="w-full py-2 rounded-lg bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-300 text-sm font-medium transition"
            >
              ⏸️ Desativar mesa
            </button>
          )}

          {vm.status === 'cancelled' && (
            <button
              onClick={() => handleStatus(vm.id, 'active')}
              className="w-full py-2 rounded-lg bg-green-500/20 hover:bg-green-500/30 text-green-300 text-sm font-medium transition"
            >
              ▶️ Reativar mesa
            </button>
          )}

          {vm.status !== 'full' && vm.slotsLeft === 0 && (
            <button
              onClick={() => handleStatus(vm.id, 'full')}
              className="w-full py-2 rounded-lg bg-orange-500/20 hover:bg-orange-500/30 text-orange-300 text-sm font-medium transition"
            >
              🔒 Marcar como lotada
            </button>
          )}

          {vm.status !== 'ended' && (
            <button
              onClick={() => handleStatus(vm.id, 'ended')}
              className="w-full py-2 rounded-lg bg-gray-500/20 hover:bg-gray-500/30 text-gray-300 text-sm font-medium transition"
            >
              ✓ Marcar como encerrada
            </button>
          )}

          {/* Arquivamento (D-MESAS1): tira do catálogo público, reversível */}
          {!vm.archived ? (
            <button
              onClick={() => handleArchive(vm.id, true)}
              className="w-full py-2 rounded-lg bg-slate-500/20 hover:bg-slate-500/30 text-slate-300 text-sm font-medium transition"
            >
              🗄️ Arquivar mesa
            </button>
          ) : (
            <button
              onClick={() => handleArchive(vm.id, false)}
              className="w-full py-2 rounded-lg bg-green-500/20 hover:bg-green-500/30 text-green-300 text-sm font-medium transition"
            >
              ♻️ Desarquivar mesa
            </button>
          )}
        </div>

        {/* Ação destrutiva isolada */}
        <div className="pt-3 border-t border-red-500/20">
          <InlineDeleteConfirmation
            title={vm.title}
            isOpen={isDeleteConfirmOpen}
            onOpen={() => setIsDeleteConfirmOpen(true)}
            onCancel={() => setIsDeleteConfirmOpen(false)}
            onConfirm={handleDeleteTable}
            isProcessing={isDeleting}
            triggerLabel="Excluir permanentemente"
            className="w-full bg-red-500/10 text-red-300 hover:bg-red-500/20"
          />
          <p className="text-xs text-red-400/60 mt-2 text-center">
            Ação irreversível
          </p>
        </div>

        {/* PREVIEW: Como visitantes veem */}
        <div className="pt-4 border-t border-white/10">
          <p className="text-xs font-semibold text-white/40 uppercase tracking-wide mb-3">
            👁 Preview Público
          </p>

          {/* Preço */}
          {vm.visibility.showPrice && vm.price !== undefined && (
            <div className="p-4 rounded-xl bg-[#13213f] border border-orange-400/30 mb-3">
              <p className="text-xs text-white/60 uppercase tracking-wide">Investimento</p>
              <p className="text-2xl font-bold text-orange-400 mt-1">
                R$ {vm.price}
                {vm.priceFrequency && (
                  <span className="text-sm text-white/60 font-normal ml-1">
                    / {vm.priceFrequency}
                  </span>
                )}
              </p>
            </div>
          )}

          {/* Info Rápida */}
          <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-2 text-sm mb-3">
            <div className="flex justify-between items-center">
              <span className="text-white/60">Sistema</span>
              {vm.systemLogoFilename || vm.systemWebsiteUrl ? (
                vm.systemWebsiteUrl ? (
                  <a
                    href={vm.systemWebsiteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 hover:opacity-80 transition"
                    title={vm.system}
                  >
                    <span className="text-white font-medium">{vm.system}</span>
                    {vm.systemLogoFilename && (
                      <img
                        src={`/sys-logos/${vm.systemLogoFilename}`}
                        alt={vm.system}
                        className="h-5 w-auto object-contain"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    )}
                  </a>
                ) : (
                  <span className="flex items-center gap-2">
                    <span className="text-white font-medium">{vm.system}</span>
                    {vm.systemLogoFilename && (
                      <img
                        src={`/sys-logos/${vm.systemLogoFilename}`}
                        alt={vm.system}
                        className="h-5 w-auto object-contain"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    )}
                  </span>
                )
              ) : (
                <span className="text-white font-medium">{vm.system}</span>
              )}
            </div>
            <div className="flex justify-between">
              <span className="text-white/60">Experiência</span>
              <span className="text-white font-medium">{vm.experience}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/60">Modalidade</span>
              <span className="text-white font-medium">{vm.modality}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/60">Vagas</span>
              <span className="text-white font-medium">
                {vm.slotsLeft} {vm.slotsLeft === 1 ? 'disponível' : 'disponíveis'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/60">Status</span>
              <span className={`font-medium ${
                vm.status === 'active' ? 'text-green-400' :
                vm.status === 'cancelled' ? 'text-yellow-400' :
                vm.status === 'full' ? 'text-orange-400' :
                vm.status === 'ended' ? 'text-red-400' :
                'text-white'
              }`}>
                {vm.status === 'active' && '✓ Ativa'}
                {vm.status === 'cancelled' && '⏸ Desativada'}
                {vm.status === 'full' && '🔒 Lotada'}
                {vm.status === 'ended' && '✕ Encerrada'}
              </span>
            </div>
            {vm.archived && (
              <div className="flex justify-between">
                <span className="text-white/60">Catálogo</span>
                <span className="font-medium text-slate-400">🗄️ Arquivada</span>
              </div>
            )}
          </div>

          {/* Plataformas */}
          {(vm.modality === 'online' || vm.modality === 'hibrida') && (vm.vttPlatform || vm.gamePlatformCustom || vm.communicationPlatform) && (
            <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/20 space-y-2 text-sm mb-3">
              <h3 className="text-xs font-semibold text-purple-300/90 uppercase tracking-wide mb-2">
                🎮 Plataformas
              </h3>
              {vm.vttPlatform && (
                <div className="flex justify-between items-center">
                  <span className="text-white/60">Jogo</span>
                  {vm.vttPlatform.website_url ? (
                    <a 
                      href={vm.vttPlatform.website_url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      onClick={() => trackTableClick(vm.slug, 'link_vtt')}
                      className="flex items-center gap-2 hover:opacity-80 hover:underline transition"
                      title={`Abrir ${vm.vttPlatform.name}`}
                    >
                      {vm.vttPlatform.logo_filename && (
                        <img 
                          src={`/vtt-logos/${vm.vttPlatform.logo_filename}`} 
                          alt={vm.vttPlatform.name}
                          className="h-6 w-auto object-contain"
                        />
                      )}
                      <span className="text-white font-medium text-sm">{vm.vttPlatform.name}</span>
                    </a>
                  ) : (
                    <div className="flex items-center gap-2">
                      {vm.vttPlatform.logo_filename && (
                        <img 
                          src={`/vtt-logos/${vm.vttPlatform.logo_filename}`} 
                          alt={vm.vttPlatform.name}
                          className="h-6 w-auto object-contain"
                        />
                      )}
                      <span className="text-white font-medium text-sm">{vm.vttPlatform.name}</span>
                    </div>
                  )}
                </div>
              )}
              {!vm.vttPlatform && vm.gamePlatformCustom && (
                <div className="flex justify-between">
                  <span className="text-white/60">Jogo</span>
                  <span className="text-white font-medium">{vm.gamePlatformCustom}</span>
                </div>
              )}
              {vm.communicationPlatform && (
                <div className="flex justify-between">
                  <span className="text-white/60">Comunicação</span>
                  <span className="text-white font-medium">{vm.communicationPlatform}</span>
                </div>
              )}
            </div>
          )}

          {/* Contatos */}
          <TableContactsBlock contacts={vm.contacts} />
        </div>
      </aside>
    );
  }

  // Modo público: CTA + conversão
  return (
    <aside className="space-y-4">
      
      {/* CTA Primário */}
      <button
        disabled={vm.cta.disabled}
        onClick={() => {
          trackTableClick(vm.slug, 'cta_entrar');
          handleCTA(vm.cta);
        }}
        className={`w-full py-3 rounded-xl font-semibold ${getButtonStyle(vm.cta.variant)}`}
      >
        {vm.cta.label}
      </button>

      {/* Urgência (Vagas) */}
      <div className={`text-sm font-semibold ${getUrgencyColor(vm.urgency.tone)}`}>
        {vm.urgency.label}
      </div>

      {/* Preço */}
      {vm.visibility.showPrice && vm.price !== undefined && (
        <div className="p-4 rounded-xl bg-[#13213f] border border-orange-400/30">
          <p className="text-xs text-white/60 uppercase tracking-wide">Investimento</p>
          <p className="text-2xl font-bold text-orange-400 mt-1">
            R$ {vm.price}
            {vm.priceFrequency && (
              <span className="text-sm text-white/60 font-normal ml-1">
                / {vm.priceFrequency}
              </span>
            )}
          </p>
        </div>
      )}

      {/* Info Rápida */}
      <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-2 text-sm">
        <div className="flex justify-between items-center">
          <span className="text-white/60">Sistema</span>
          {vm.systemLogoFilename || vm.systemWebsiteUrl ? (
            vm.systemWebsiteUrl ? (
              <a
                href={vm.systemWebsiteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 hover:opacity-80 transition"
                title={vm.system}
              >
                <span className="text-white font-medium">{vm.system}</span>
                {vm.systemLogoFilename && (
                  <img
                    src={`/sys-logos/${vm.systemLogoFilename}`}
                    alt={vm.system}
                    className="h-5 w-auto object-contain"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                )}
              </a>
            ) : (
              <span className="flex items-center gap-2">
                <span className="text-white font-medium">{vm.system}</span>
                {vm.systemLogoFilename && (
                  <img
                    src={`/sys-logos/${vm.systemLogoFilename}`}
                    alt={vm.system}
                    className="h-5 w-auto object-contain"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                )}
              </span>
            )
          ) : (
            <span className="text-white font-medium">{vm.system}</span>
          )}
        </div>
        <div className="flex justify-between">
          <span className="text-white/60">Experiência</span>
          <span className="text-white font-medium">{vm.experience}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-white/60">Modalidade</span>
          <span className="text-white font-medium">{vm.modality}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-white/60">Vagas</span>
          <span className="text-white font-medium">
            {vm.slotsLeft} {vm.slotsLeft === 1 ? 'disponível' : 'disponíveis'}
          </span>
        </div>
      </div>

      {/* CORREÇÃO C06: Plataformas (apenas para online/híbrida) */}
      {(vm.modality === 'online' || vm.modality === 'hibrida') && (vm.vttPlatform || vm.gamePlatformCustom || vm.communicationPlatform) && (
        <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/20 space-y-2 text-sm">
          <h3 className="text-xs font-semibold text-purple-300/90 uppercase tracking-wide mb-2">
            🎮 Plataformas
          </h3>
          {/* VTT Platform com logo */}
          {vm.vttPlatform && (
            <div className="flex justify-between items-center">
              <span className="text-white/60">Jogo</span>
              {vm.vttPlatform.website_url ? (
                <a 
                  href={vm.vttPlatform.website_url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 hover:opacity-80 hover:underline transition"
                  title={`Abrir ${vm.vttPlatform.name}`}
                >
                  {vm.vttPlatform.logo_filename && (
                    <img 
                      src={`/vtt-logos/${vm.vttPlatform.logo_filename}`} 
                      alt={vm.vttPlatform.name}
                      className="h-6 w-auto object-contain"
                    />
                  )}
                  <span className="text-white font-medium text-sm">{vm.vttPlatform.name}</span>
                </a>
              ) : (
                <div className="flex items-center gap-2">
                  {vm.vttPlatform.logo_filename && (
                    <img 
                      src={`/vtt-logos/${vm.vttPlatform.logo_filename}`} 
                      alt={vm.vttPlatform.name}
                      className="h-6 w-auto object-contain"
                    />
                  )}
                  <span className="text-white font-medium text-sm">{vm.vttPlatform.name}</span>
                </div>
              )}
            </div>
          )}
          {/* Plataforma customizada (quando não tem VTT cadastrada) */}
          {!vm.vttPlatform && vm.gamePlatformCustom && (
            <div className="flex justify-between">
              <span className="text-white/60">Jogo</span>
              <span className="text-white font-medium">{vm.gamePlatformCustom}</span>
            </div>
          )}
          {vm.communicationPlatform && (
            <div className="flex justify-between">
              <span className="text-white/60">Comunicação</span>
              <span className="text-white font-medium">{vm.communicationPlatform}</span>
            </div>
          )}
        </div>
      )}

      {/* Contatos - Componente dedicado com design system completo */}
      <TableContactsBlock contacts={vm.contacts} />
    </aside>
  );
}
