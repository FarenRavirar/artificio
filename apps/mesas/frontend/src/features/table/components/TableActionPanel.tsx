import { useState } from 'react';
import toast from 'react-hot-toast';
import type { TableViewModel, TableActionPanelVariant } from '../types/tableView.types';
import type { TableDetail } from '../../../types/tables';
import { InlineDeleteConfirmation } from '../../../components/InlineDeleteConfirmation';
import { getButtonStyle, getUrgencyColor, handleCTA, handleEdit, handleStatus, handleArchive } from '../utils/uiHelpers';
import { TableContactsBlock } from './TableContactsBlock';
import { CopyAnnouncementButton } from './CopyAnnouncementButton';
import { useTracking } from '../../../hooks/useTracking';
import { authDelete } from '../../../services/apiClient';

interface TableActionPanelProps {
  vm: TableViewModel;
  variant?: TableActionPanelVariant;
  deleteEndpointScope?: 'gm' | 'admin';
  announcementTable?: TableDetail;
}

/**
 * Action Panel - Motor de decisão
 * Ordem fixa: CTA → Urgência → Preço → Info → Contato
 * Reutilizável em: MesaPage, Painel do Mestre, Card expandido
 */
export function TableActionPanel({ vm, variant = 'full', deleteEndpointScope = 'gm', announcementTable }: TableActionPanelProps) {
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

      const res = await authDelete(deleteEndpoint);

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
        <div className="p-4 rounded-xl bg-[var(--fill-subtle)] border border-[var(--line)] space-y-2">
          <p className="text-xs font-semibold text-[var(--fg-muted)] uppercase tracking-wide mb-3">
            Gerenciamento
          </p>

          <button
            onClick={() => handleEdit(vm.id)}
            className="w-full py-2 rounded-lg bg-[var(--state-info-bg)] hover:bg-[var(--state-info-bg)] text-[var(--state-info-fg)] text-sm font-medium transition"
          >
            ✏️ Editar mesa
          </button>

          {announcementTable && announcementTable.status === 'active' && !announcementTable.archived_at && (
            <CopyAnnouncementButton table={announcementTable} />
          )}

          {vm.status !== 'cancelled' && vm.status !== 'draft' && (
            <button
              onClick={() => handleStatus(vm.id, 'cancelled')}
              className="w-full py-2 rounded-lg bg-[var(--state-warning-bg)] hover:bg-[var(--state-warning-bg)] text-[var(--state-warning-fg)] text-sm font-medium transition"
            >
              ⏸️ Desativar mesa
            </button>
          )}

          {vm.status === 'cancelled' && (
            <button
              onClick={() => handleStatus(vm.id, 'active')}
              className="w-full py-2 rounded-lg bg-[var(--state-success-bg)] hover:bg-[var(--state-success-bg)] text-[var(--state-success-fg)] text-sm font-medium transition"
            >
              ▶️ Reativar mesa
            </button>
          )}

          {vm.status !== 'full' && vm.slotsLeft === 0 && (
            <button
              onClick={() => handleStatus(vm.id, 'full')}
              className="w-full py-2 rounded-lg bg-[var(--state-warning-bg)] hover:bg-[var(--state-warning-bg)] text-[var(--state-warning-fg)] text-sm font-medium transition"
            >
              🔒 Marcar como lotada
            </button>
          )}

          {vm.status !== 'ended' && vm.status !== 'draft' && (
            <button
              onClick={() => handleStatus(vm.id, 'ended')}
              className="w-full py-2 rounded-lg bg-[var(--fill)] hover:bg-[var(--fill)] text-[var(--fg-muted)] text-sm font-medium transition"
            >
              ✓ Marcar como encerrada
            </button>
          )}

          {/* Arquivamento (D-MESAS1): tira do catálogo público, reversível */}
          {!vm.archived ? (
            <button
              onClick={() => handleArchive(vm.id, true)}
              className="w-full py-2 rounded-lg bg-[var(--fill)] hover:bg-[var(--fill)] text-[var(--fg-muted)] text-sm font-medium transition"
            >
              🗄️ Arquivar mesa
            </button>
          ) : (
            <button
              onClick={() => handleArchive(vm.id, false)}
              className="w-full py-2 rounded-lg bg-[var(--state-success-bg)] hover:bg-[var(--state-success-bg)] text-[var(--state-success-fg)] text-sm font-medium transition"
            >
              ♻️ Desarquivar mesa
            </button>
          )}
        </div>

        {/* Ação destrutiva isolada */}
        <div className="pt-3 border-t border-[var(--state-danger-line)]">
          <InlineDeleteConfirmation
            title={vm.title}
            isOpen={isDeleteConfirmOpen}
            onOpen={() => setIsDeleteConfirmOpen(true)}
            onCancel={() => setIsDeleteConfirmOpen(false)}
            onConfirm={handleDeleteTable}
            isProcessing={isDeleting}
            triggerLabel="Excluir permanentemente"
            className="w-full bg-[var(--state-danger-bg)] text-[var(--state-danger-fg)] hover:bg-[var(--state-danger-bg)]"
          />
          <p className="text-xs text-[var(--state-danger-fg)] mt-2 text-center">
            Ação irreversível
          </p>
        </div>

        {/* PREVIEW: Como visitantes veem */}
        <div className="pt-4 border-t border-[var(--line)]">
          <p className="text-xs font-semibold text-[var(--fg-muted)] uppercase tracking-wide mb-3">
            👁 Preview Público
          </p>

          {/* Preço */}
          {vm.visibility.showPrice && vm.price !== undefined && (
            <div className="p-4 rounded-xl bg-[var(--surface-subtle)] border border-[var(--state-warning-line)] mb-3">
              <p className="text-xs text-[var(--fg-muted)] uppercase tracking-wide">Investimento</p>
              <p className="text-2xl font-bold text-[var(--state-warning-fg)] mt-1">
                R$ {vm.price}
                {vm.priceFrequency && (
                  <span className="text-sm text-[var(--fg-muted)] font-normal ml-1">
                    / {vm.priceFrequency}
                  </span>
                )}
              </p>
            </div>
          )}

          {/* Info Rápida */}
          <div className="p-4 rounded-xl bg-[var(--fill-subtle)] border border-[var(--line)] space-y-2 text-sm mb-3">
            <div className="flex justify-between items-center">
              <span className="text-[var(--fg-muted)]">Sistema</span>
              {vm.systemLogoFilename || vm.systemWebsiteUrl ? (
                vm.systemWebsiteUrl ? (
                  <a
                    href={vm.systemWebsiteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 hover:opacity-80 transition"
                    title={vm.system}
                  >
                    <span className="text-[var(--fg)] font-medium">{vm.system}</span>
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
                    <span className="text-[var(--fg)] font-medium">{vm.system}</span>
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
                <span className="text-[var(--fg)] font-medium">{vm.system}</span>
              )}
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--fg-muted)]">Experiência</span>
              <span className="text-[var(--fg)] font-medium">{vm.experience}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--fg-muted)]">Modalidade</span>
              <span className="text-[var(--fg)] font-medium">{vm.modality}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--fg-muted)]">Vagas</span>
              <span className="text-[var(--fg)] font-medium">
                {vm.slotsLeft} {vm.slotsLeft === 1 ? 'disponível' : 'disponíveis'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--fg-muted)]">Status</span>
              <span className={`font-medium ${
                vm.status === 'active' ? 'text-[var(--state-success-fg)]' :
                vm.status === 'cancelled' ? 'text-[var(--state-warning-fg)]' :
                vm.status === 'full' ? 'text-[var(--state-warning-fg)]' :
                vm.status === 'ended' ? 'text-[var(--state-danger-fg)]' :
                vm.status === 'draft' ? 'text-[var(--fg-muted)]' :
                'text-[var(--fg)]'
              }`}>
                {vm.status === 'active' && '✓ Ativa'}
                {vm.status === 'cancelled' && '⏸ Desativada'}
                {vm.status === 'full' && '🔒 Lotada'}
                {vm.status === 'ended' && '✕ Encerrada'}
                {vm.status === 'draft' && '📝 Rascunho (não publicada)'}
              </span>
            </div>
            {vm.archived && (
              <div className="flex justify-between">
                <span className="text-[var(--fg-muted)]">Catálogo</span>
                <span className="font-medium text-[var(--fg-muted)]">🗄️ Arquivada</span>
              </div>
            )}
          </div>

          {/* Plataformas */}
          {(vm.modality === 'online' || vm.modality === 'hibrida') && (vm.vttPlatform || vm.gamePlatformCustom || vm.communicationPlatform) && (
            <div className="p-4 rounded-xl bg-[rgba(168,85,247,0.10)] border border-[rgba(168,85,247,0.20)] space-y-2 text-sm mb-3">
              <h3 className="text-xs font-semibold text-[var(--special)] uppercase tracking-wide mb-2">
                🎮 Plataformas
              </h3>
              {vm.vttPlatform && (
                <div className="flex justify-between items-center">
                  <span className="text-[var(--fg-muted)]">Jogo</span>
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
                      <span className="text-[var(--fg)] font-medium text-sm">{vm.vttPlatform.name}</span>
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
                      <span className="text-[var(--fg)] font-medium text-sm">{vm.vttPlatform.name}</span>
                    </div>
                  )}
                </div>
              )}
              {!vm.vttPlatform && vm.gamePlatformCustom && (
                <div className="flex justify-between">
                  <span className="text-[var(--fg-muted)]">Jogo</span>
                  <span className="text-[var(--fg)] font-medium">{vm.gamePlatformCustom}</span>
                </div>
              )}
              {vm.communicationPlatform && (
                <div className="flex justify-between">
                  <span className="text-[var(--fg-muted)]">Comunicação</span>
                  <span className="text-[var(--fg)] font-medium">{vm.communicationPlatform}</span>
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

      {announcementTable && announcementTable.status === 'active' && !announcementTable.archived_at && (
        <CopyAnnouncementButton table={announcementTable} />
      )}

      {/* Urgência (Vagas) */}
      <div className={`text-sm font-semibold ${getUrgencyColor(vm.urgency.tone)}`}>
        {vm.urgency.label}
      </div>

      {/* Preço */}
      {vm.visibility.showPrice && vm.price !== undefined && (
        <div className="p-4 rounded-xl bg-[var(--surface-subtle)] border border-[var(--state-warning-line)]">
          <p className="text-xs text-[var(--fg-muted)] uppercase tracking-wide">Investimento</p>
          <p className="text-2xl font-bold text-[var(--state-warning-fg)] mt-1">
            R$ {vm.price}
            {vm.priceFrequency && (
              <span className="text-sm text-[var(--fg-muted)] font-normal ml-1">
                / {vm.priceFrequency}
              </span>
            )}
          </p>
        </div>
      )}

      {/* Info Rápida */}
      <div className="p-4 rounded-xl bg-[var(--fill-subtle)] border border-[var(--line)] space-y-2 text-sm">
        <div className="flex justify-between items-center">
          <span className="text-[var(--fg-muted)]">Sistema</span>
          {vm.systemLogoFilename || vm.systemWebsiteUrl ? (
            vm.systemWebsiteUrl ? (
              <a
                href={vm.systemWebsiteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 hover:opacity-80 transition"
                title={vm.system}
              >
                <span className="text-[var(--fg)] font-medium">{vm.system}</span>
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
                <span className="text-[var(--fg)] font-medium">{vm.system}</span>
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
            <span className="text-[var(--fg)] font-medium">{vm.system}</span>
          )}
        </div>
        <div className="flex justify-between">
          <span className="text-[var(--fg-muted)]">Experiência</span>
          <span className="text-[var(--fg)] font-medium">{vm.experience}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[var(--fg-muted)]">Modalidade</span>
          <span className="text-[var(--fg)] font-medium">{vm.modality}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[var(--fg-muted)]">Vagas</span>
          <span className="text-[var(--fg)] font-medium">
            {vm.slotsLeft} {vm.slotsLeft === 1 ? 'disponível' : 'disponíveis'}
          </span>
        </div>
      </div>

      {/* CORREÇÃO C06: Plataformas (apenas para online/híbrida) */}
      {(vm.modality === 'online' || vm.modality === 'hibrida') && (vm.vttPlatform || vm.gamePlatformCustom || vm.communicationPlatform) && (
        <div className="p-4 rounded-xl bg-[rgba(168,85,247,0.10)] border border-[rgba(168,85,247,0.20)] space-y-2 text-sm">
          <h3 className="text-xs font-semibold text-[var(--special)] uppercase tracking-wide mb-2">
            🎮 Plataformas
          </h3>
          {/* VTT Platform com logo */}
          {vm.vttPlatform && (
            <div className="flex justify-between items-center">
              <span className="text-[var(--fg-muted)]">Jogo</span>
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
                  <span className="text-[var(--fg)] font-medium text-sm">{vm.vttPlatform.name}</span>
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
                  <span className="text-[var(--fg)] font-medium text-sm">{vm.vttPlatform.name}</span>
                </div>
              )}
            </div>
          )}
          {/* Plataforma customizada (quando não tem VTT cadastrada) */}
          {!vm.vttPlatform && vm.gamePlatformCustom && (
            <div className="flex justify-between">
              <span className="text-[var(--fg-muted)]">Jogo</span>
              <span className="text-[var(--fg)] font-medium">{vm.gamePlatformCustom}</span>
            </div>
          )}
          {vm.communicationPlatform && (
            <div className="flex justify-between">
              <span className="text-[var(--fg-muted)]">Comunicação</span>
              <span className="text-[var(--fg)] font-medium">{vm.communicationPlatform}</span>
            </div>
          )}
        </div>
      )}

      {/* Contatos - Componente dedicado com design system completo */}
      <TableContactsBlock contacts={vm.contacts} />
    </aside>
  );
}
