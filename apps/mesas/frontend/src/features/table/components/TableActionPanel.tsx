import { useState } from 'react';
import toast from 'react-hot-toast';
import type { TableViewModel, TableActionPanelVariant } from '../types/tableView.types';
import type { TableDetail } from '../../../types/tables';
import { InlineDeleteConfirmation } from '../../../components/InlineDeleteConfirmation';
import { getButtonStyle, getUrgencyColor, handleCTA, handleEdit, handleStatus, handleArchive } from '../utils/uiHelpers';
import { TableContactsBlock } from './TableContactsBlock';
import { CopyAnnouncementButton } from './CopyAnnouncementButton';
import { isTableAnnounceable } from '../share/whatsappAnnouncement';
import { useTracking } from '../../../hooks/useTracking';
import { authDelete } from '../../../services/apiClient';
import { ageRatingLabel } from '../../../utils/ageRating';

interface TableActionPanelProps {
  readonly vm: TableViewModel;
  readonly variant?: TableActionPanelVariant;
  readonly deleteEndpointScope?: 'gm' | 'admin';
  readonly announcementTable?: TableDetail;
}

type PanelVm = TableActionPanelProps['vm'];

type AnnouncementSlotProps = {
  readonly announcementTable?: TableDetail;
};

function AnnouncementSlot({ announcementTable }: AnnouncementSlotProps) {
  return isTableAnnounceable(announcementTable) ? <CopyAnnouncementButton table={announcementTable} /> : null;
}

function PricePanel({ vm, className = '' }: { readonly vm: PanelVm; readonly className?: string }) {
  // `priceType` é a fonte de verdade (ampliação doações, sessão 26-08-22_1):
  // mesa gratuita renderiza o banner "Gratuita" mesmo quando showPrice é false
  // (showPrice = !!price_value, que é null em mesa gratuita). priceType ausente
  // = ViewModel antigo construído sem o campo → comportamento anterior.
  if (vm.priceType === 'gratuita') {
    const hasSuggested = typeof vm.suggestedDonationValue === 'number';

    return (
      <div className={`p-4 rounded-xl bg-[var(--surface-subtle)] border border-[var(--state-success-line)] ${className}`.trim()}>
        <div className="flex items-center gap-2">
          <p className="text-xs text-[var(--fg-muted)] uppercase tracking-wide">Cobrança</p>
          <span className="rounded-full bg-green-500 px-2 py-0.5 text-[10px] font-black tracking-wide text-black">
            🎉 Gratuita
          </span>
        </div>
        <p className="text-sm font-semibold text-[var(--state-success-fg)] mt-1">
          Mesa gratuita — sem cobrança, jogue de graça.
        </p>
        {vm.acceptsDonations && (
          <>
            <p className="text-sm text-[var(--fg)] mt-2">
              💝 Aceita doações
              {hasSuggested && (
                <span className="text-[var(--fg-muted)]"> · Valor sugerido: R$ {vm.suggestedDonationValue} / sessão</span>
              )}
            </p>
            <p className="text-xs text-[var(--fg-muted)] mt-1">
              Doação combinada diretamente com o mestre, fora da plataforma.
            </p>
          </>
        )}
      </div>
    );
  }

  if (!vm.visibility.showPrice || vm.price === undefined) return null;

  const monthly = vm.priceMonthly;
  const hasMonthly = typeof monthly === 'number' && monthly >= 0;
  // Economia é derivada só na exibição, nunca armazenada (decisão de produto):
  // só quando o mensal é estritamente mais barato que o avulso.
  const savingsPercent = hasMonthly && monthly < vm.price
    ? Math.round((1 - monthly / vm.price) * 100)
    : null;

  return (
    <div className={`p-4 rounded-xl bg-[var(--surface-subtle)] border border-[var(--state-warning-line)] ${className}`.trim()}>
      <div className="flex items-center gap-2">
        <p className="text-xs text-[var(--fg-muted)] uppercase tracking-wide">Investimento</p>
        {/* T9.2 (spec 081): selo de mesa paga em destaque visual */}
        <span className="rounded-full bg-yellow-500 px-2 py-0.5 text-[10px] font-black tracking-wide text-black">
          💰 Paga
        </span>
      </div>
      <p className="text-2xl font-bold text-[var(--state-warning-fg)] mt-1">
        R$ {vm.price}
        {vm.priceFrequency && (
          <span className="text-sm text-[var(--fg-muted)] font-normal ml-1">/ {vm.priceFrequency}</span>
        )}
      </p>
      {hasMonthly && (
        <p className="text-sm text-[var(--fg-muted)] mt-1">
          Pacote mensal: <span className="text-[var(--fg)] font-medium">R$ {monthly}</span>
          <span className="text-[var(--fg-muted)]"> / sessão</span>
          {savingsPercent !== null && savingsPercent > 0 && (
            <span className="text-green-400 ml-2">economize ~{savingsPercent}%</span>
          )}
        </p>
      )}
      {/* T6.4 (spec 081): mesa paga é anúncio dentro de plataforma gratuita —
          cobrança é acordo direto com o mestre, não passa pela Artifício. */}
      <p className="text-xs text-[var(--fg-muted)] mt-2">
        💬 Cobrança combinada diretamente com o mestre, fora da plataforma.
      </p>
    </div>
  );
}

function SystemInfoValue({ vm }: { readonly vm: PanelVm }) {
  const logo = vm.systemLogoFilename && (
    <img
      src={`/sys-logos/${vm.systemLogoFilename}`}
      alt={vm.system}
      className="h-5 w-auto object-contain"
      onError={(e) => {
        e.currentTarget.style.display = 'none';
      }}
    />
  );

  const content = (
    <>
      <span className="text-[var(--fg)] font-medium">{vm.system}</span>
      {logo}
    </>
  );

  if (!vm.systemWebsiteUrl) {
    return <span className={vm.systemLogoFilename ? 'flex items-center gap-2' : 'text-[var(--fg)] font-medium'}>{content}</span>;
  }

  return (
    <a
      href={vm.systemWebsiteUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 hover:opacity-80 transition"
      title={vm.system}
    >
      {content}
    </a>
  );
}

function StatusText({ vm }: { readonly vm: PanelVm }) {
  const statusLabels: Record<string, string> = {
    active: '✓ Ativa',
    cancelled: '⏸ Desativada',
    full: '🔒 Lotada',
    ended: '✕ Encerrada',
    draft: '📝 Rascunho (não publicada)',
  };

  const statusClass: Record<string, string> = {
    active: 'text-[var(--state-success-fg)]',
    cancelled: 'text-[var(--state-warning-fg)]',
    full: 'text-[var(--state-warning-fg)]',
    ended: 'text-[var(--state-danger-fg)]',
    draft: 'text-[var(--fg-muted)]',
  };

  return <span className={`font-medium ${statusClass[vm.status] ?? 'text-[var(--fg)]'}`}>{statusLabels[vm.status] ?? vm.status}</span>;
}

/**
 * Formata a linha de vagas (R22, spec 093). O total nunca apareceu na página;
 * a ficha técnica passa a dizer "2 de 5 vagas" em vez de só o restante — ou
 * nada, nos ramos em que `vm.urgency` não cita número algum.
 */
function formatSlots(vm: PanelVm): string | null {
  if (vm.slotsTotal == null) return null;
  // T7.5: total preenchido mas `slots_open` nulo — mostrar o que existe,
  // sem inventar o restante.
  if (vm.slotsOpen == null) {
    return `Mesa de ${vm.slotsTotal} ${vm.slotsTotal === 1 ? 'jogador' : 'jogadores'}`;
  }
  return `${vm.slotsLeft} de ${vm.slotsTotal} vagas`;
}

function QuickInfoPanel({ vm, showStatus = false, className = '' }: { readonly vm: PanelVm; readonly showStatus?: boolean; readonly className?: string }) {
  const slotsLabel = formatSlots(vm);
  return (
    <div className={`p-4 rounded-xl bg-[var(--fill-subtle)] border border-[var(--line)] space-y-2 text-sm ${className}`.trim()}>
      <div className="flex justify-between items-center">
        <span className="text-[var(--fg-muted)]">Sistema</span>
        <SystemInfoValue vm={vm} />
      </div>
      <div className="flex justify-between">
        <span className="text-[var(--fg-muted)]">Experiência</span>
        <span className="text-[var(--fg)] font-medium">{vm.experience}</span>
      </div>
      {/* R24/A27 (spec 096): faixa etária visível ao jogador na página da mesa.
          Faixas reais e 'livre' aparecem ("Livre" é a informação, não o selo
          🔞 de restrição — decisão do mantenedor 2026-08-24); null/valor fora
          do enum ficam em silêncio. */}
      {ageRatingLabel(vm.ageRating) !== null && (
        <div className="flex justify-between">
          <span className="text-[var(--fg-muted)]">Faixa etária</span>
          <span className="text-[var(--fg)] font-medium">{ageRatingLabel(vm.ageRating)}</span>
        </div>
      )}
      {/* R24 + aceite 13 (spec 093): idioma aparece sempre que preenchido, inclusive
          `pt-BR`. A versão anterior escondia `pt-BR` alegando ruído (92/94 em produção),
          mas isso contradizia o aceite — e a premissa estava errada: `pt-BR` NÃO é default
          de banco (`migration_01_base_schema.sql:141` usa `'Português'`). Os 92 vêm de
          `syncHelpers.ts:336`, que grava `'pt-BR'` fixo em mesa importada, e do editor
          de anúncio (spec 096, AudiencePart — antes, `useCreateTableForm.ts:39`), onde o
          mestre pode escolher `pt-BR` de propósito —
          caso indistinguível do sync, então esconder apagava escolha real.
          Achado real (review PR #280, codex, P2). */}
      {vm.language && (
        <div className="flex justify-between">
          <span className="text-[var(--fg-muted)]">Idioma</span>
          <span className="text-[var(--fg)] font-medium">{vm.language}</span>
        </div>
      )}
      <div className="flex justify-between">
        <span className="text-[var(--fg-muted)]">Modalidade</span>
        <span className="text-[var(--fg)] font-medium">{vm.modality}</span>
      </div>
      {/* R23 (spec 093): cidade/estado só quando preenchidos — mesa online
          legítima não tem local, e rótulo vazio é ruído. */}
      {(vm.city || vm.state) && (
        <div className="flex justify-between">
          <span className="text-[var(--fg-muted)]">Local</span>
          <span className="text-[var(--fg)] font-medium">{[vm.city, vm.state].filter(Boolean).join(', ')}</span>
        </div>
      )}
      {/* R22 (spec 093): vagas com total. A linha original foi removida (T4.3)
          supondo que `vm.urgency` cobria o dado; cobre em 3 dos 6 ramos
          (tableViewMapper.ts:96-141) — em "Mesa lotada", "desativada" e
          "encerrada" o número some. Mantém-se `vm.urgency` (alerta, o tom) e
          esta linha (ficha técnica, o fato): não são duplicata. */}
      {slotsLabel && (
        <div className="flex justify-between">
          <span className="text-[var(--fg-muted)]">Vagas</span>
          <span className="text-[var(--fg)] font-medium">{slotsLabel}</span>
        </div>
      )}
      {showStatus && (
        <div className="flex justify-between">
          <span className="text-[var(--fg-muted)]">Status</span>
          <StatusText vm={vm} />
        </div>
      )}
      {showStatus && vm.archived && (
        <div className="flex justify-between">
          <span className="text-[var(--fg-muted)]">Catálogo</span>
          <span className="font-medium text-[var(--fg-muted)]">🗄️ Arquivada</span>
        </div>
      )}
    </div>
  );
}

function VttPlatformRow({ vm, trackTableClick }: { readonly vm: PanelVm; readonly trackTableClick?: (slug: string, action: string) => void }) {
  if (!vm.vttPlatform) return null;

  const logo = vm.vttPlatform.logo_filename && (
    <img src={`/vtt-logos/${vm.vttPlatform.logo_filename}`} alt={vm.vttPlatform.name} className="h-6 w-auto object-contain" />
  );
  const content = (
    <>
      {logo}
      <span className="text-[var(--fg)] font-medium text-sm">{vm.vttPlatform.name}</span>
    </>
  );

  return (
    <div className="flex justify-between items-center">
      <span className="text-[var(--fg-muted)]">Jogo</span>
      {vm.vttPlatform.website_url ? (
        <a
          href={vm.vttPlatform.website_url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => trackTableClick?.(vm.slug, 'link_vtt')}
          className="flex items-center gap-2 hover:opacity-80 hover:underline transition"
          title={`Abrir ${vm.vttPlatform.name}`}
        >
          {content}
        </a>
      ) : (
        <div className="flex items-center gap-2">{content}</div>
      )}
    </div>
  );
}

function PlatformsPanel({ vm, trackTableClick, className = '' }: { readonly vm: PanelVm; readonly trackTableClick?: (slug: string, action: string) => void; readonly className?: string }) {
  const shouldShow = (vm.modality === 'online' || vm.modality === 'hibrida')
    && (vm.vttPlatform || vm.gamePlatformCustom || vm.communicationPlatform);
  if (!shouldShow) return null;

  return (
    <div className={`p-4 rounded-xl bg-[rgba(168,85,247,0.10)] border border-[rgba(168,85,247,0.20)] space-y-2 text-sm ${className}`.trim()}>
      <h3 className="text-xs font-semibold text-[var(--special)] uppercase tracking-wide mb-2">🎮 Plataformas</h3>
      <VttPlatformRow vm={vm} trackTableClick={trackTableClick} />
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
  );
}

function ManagementPanel({ vm, announcementTable }: { readonly vm: PanelVm; readonly announcementTable?: TableDetail }) {
  return (
    <div className="p-4 rounded-xl bg-[var(--fill-subtle)] border border-[var(--line)] space-y-2">
      <p className="text-xs font-semibold text-[var(--fg-muted)] uppercase tracking-wide mb-3">Gerenciamento</p>
      <button onClick={() => handleEdit(vm.id)} className="w-full py-2 rounded-lg bg-[var(--state-info-bg)] hover:bg-[var(--state-info-bg)] text-[var(--state-info-fg)] text-sm font-medium transition">
        ✏️ Editar mesa
      </button>
      <AnnouncementSlot announcementTable={announcementTable} />
      {vm.status !== 'cancelled' && vm.status !== 'draft' && (
        <button onClick={() => handleStatus(vm.id, 'cancelled')} className="w-full py-2 rounded-lg bg-[var(--state-warning-bg)] hover:bg-[var(--state-warning-bg)] text-[var(--state-warning-fg)] text-sm font-medium transition">⏸️ Desativar mesa</button>
      )}
      {vm.status === 'cancelled' && (
        <button onClick={() => handleStatus(vm.id, 'active')} className="w-full py-2 rounded-lg bg-[var(--state-success-bg)] hover:bg-[var(--state-success-bg)] text-[var(--state-success-fg)] text-sm font-medium transition">▶️ Reativar mesa</button>
      )}
      {vm.status !== 'full' && vm.slotsLeft === 0 && (
        <button onClick={() => handleStatus(vm.id, 'full')} className="w-full py-2 rounded-lg bg-[var(--state-warning-bg)] hover:bg-[var(--state-warning-bg)] text-[var(--state-warning-fg)] text-sm font-medium transition">🔒 Marcar como lotada</button>
      )}
      {vm.status !== 'ended' && vm.status !== 'draft' && (
        <button onClick={() => handleStatus(vm.id, 'ended')} className="w-full py-2 rounded-lg bg-[var(--fill)] hover:bg-[var(--fill)] text-[var(--fg-muted)] text-sm font-medium transition">✓ Marcar como encerrada</button>
      )}
      {!vm.archived ? (
        <button onClick={() => handleArchive(vm.id, true)} className="w-full py-2 rounded-lg bg-[var(--fill)] hover:bg-[var(--fill)] text-[var(--fg-muted)] text-sm font-medium transition">🗄️ Arquivar mesa</button>
      ) : (
        <button onClick={() => handleArchive(vm.id, false)} className="w-full py-2 rounded-lg bg-[var(--state-success-bg)] hover:bg-[var(--state-success-bg)] text-[var(--state-success-fg)] text-sm font-medium transition">♻️ Desarquivar mesa</button>
      )}
    </div>
  );
}

function DeleteTablePanel({ vm, isOpen, isDeleting, onOpen, onCancel, onConfirm }: {
  readonly vm: PanelVm;
  readonly isOpen: boolean;
  readonly isDeleting: boolean;
  readonly onOpen: () => void;
  readonly onCancel: () => void;
  readonly onConfirm: () => void | Promise<void>;
}) {
  return (
    <div className="pt-3 border-t border-[var(--state-danger-line)]">
      <InlineDeleteConfirmation
        title={vm.title}
        isOpen={isOpen}
        onOpen={onOpen}
        onCancel={onCancel}
        onConfirm={onConfirm}
        isProcessing={isDeleting}
        triggerLabel="Excluir permanentemente"
        className="w-full bg-[var(--state-danger-bg)] text-[var(--state-danger-fg)] hover:bg-[var(--state-danger-bg)]"
      />
      <p className="text-xs text-[var(--state-danger-fg)] mt-2 text-center">Ação irreversível</p>
    </div>
  );
}

function VisitorPreview({ vm, trackTableClick }: { readonly vm: PanelVm; readonly trackTableClick: (slug: string, action: string) => void }) {
  return (
    <div className="pt-4 border-t border-[var(--line)]">
      <p className="text-xs font-semibold text-[var(--fg-muted)] uppercase tracking-wide mb-3">👁 Preview Público</p>
      <PricePanel vm={vm} className="mb-3" />
      <QuickInfoPanel vm={vm} showStatus className="mb-3" />
      <PlatformsPanel vm={vm} trackTableClick={trackTableClick} className="mb-3" />
      <TableContactsBlock contacts={vm.contacts} />
    </div>
  );
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

  if (variant === 'owner') {
    return (
      <aside className="space-y-4">
        <ManagementPanel vm={vm} announcementTable={announcementTable} />
        <DeleteTablePanel
          vm={vm}
          isOpen={isDeleteConfirmOpen}
          isDeleting={isDeleting}
          onOpen={() => setIsDeleteConfirmOpen(true)}
          onCancel={() => setIsDeleteConfirmOpen(false)}
          onConfirm={handleDeleteTable}
        />
        <VisitorPreview vm={vm} trackTableClick={trackTableClick} />
      </aside>
    );
  }

  return (
    <aside className="space-y-4">
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
      <AnnouncementSlot announcementTable={announcementTable} />
      <div className={`text-sm font-semibold ${getUrgencyColor(vm.urgency.tone)}`}>
        {vm.urgency.label}
      </div>
      <PricePanel vm={vm} />
      <QuickInfoPanel vm={vm} />
      <PlatformsPanel vm={vm} />
      <TableContactsBlock contacts={vm.contacts} />
    </aside>
  );
}
