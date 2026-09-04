import { Check, Copy, ExternalLink } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTracking } from '../../hooks/useTracking';
import type { TableContactChannel } from '../../types/tables';
import {
  formatWhatsAppDisplay,
  openSafeExternalUrl,
  toSafeDiscordInviteUrl,
  toSafeMailtoUrl,
  toSafeSocialProfileUrl,
  toWhatsAppUrl,
} from '../../utils/safeExternalUrl';
import { CONTACT_CHANNEL_META } from './channelMeta';

/**
 * Contato público do mestre (T4.0r): os MESMOS 7 canais do editor e do
 * backend (TABLE_CONTACT_CHANNELS). Antes só 4 eram exibidos (hardcoded) e um
 * canal novo salvo no perfil sumia da página sem erro — a serialização
 * aceitava e a exibição ignorava. Ícone, label e cor de identidade por canal
 * vêm de `channelMeta.ts` (fonte única com o editor, A1); aqui só mora o
 * específico da exibição pública (cores do card e actionLabel).
 */

interface ContactMethod {
  channel: TableContactChannel;
  value: string;
  label?: string | null;
  discord_server_url?: string | null;
}

interface MestreContactMethodsProps {
  contacts: ContactMethod[];
  gmSlug: string;
}

interface ChannelDisplayConfig {
  color: string;
  borderColor: string;
  buttonColor: string;
  actionLabel: string;
}

/**
 * Cores de exibição do card por canal — classes COMPLETAS (o Tailwind não
 * gera classe montada em runtime; o editor antigo usava `text-${cor}-400` e
 * os ícones caíam sem cor). A cor de identidade do ícone/texto
 * (`text-*-400`) está no channelMeta (iconClass), junto de ícone e label.
 */
const CHANNEL_CONFIG: Record<TableContactChannel, ChannelDisplayConfig> = {
  whatsapp: {
    color: 'from-green-500/20 to-green-600/20',
    borderColor: 'border-green-500/30',
    buttonColor: 'bg-green-500 hover:bg-green-600',
    actionLabel: 'Enviar mensagem',
  },
  discord: {
    color: 'from-indigo-500/20 to-indigo-600/20',
    borderColor: 'border-indigo-500/30',
    buttonColor: 'bg-indigo-500 hover:bg-indigo-600',
    actionLabel: 'Copiar username',
  },
  phone: {
    color: 'from-emerald-500/20 to-emerald-600/20',
    borderColor: 'border-emerald-500/30',
    buttonColor: 'bg-emerald-500 hover:bg-emerald-600',
    // Telefone abre WhatsApp (toWhatsAppUrl) — mesma decisão do canal
    // dedicado: ninguém liga para contato de mesa (regra 2026-08-03).
    actionLabel: 'Enviar mensagem',
  },
  email: {
    color: 'from-blue-500/20 to-blue-600/20',
    borderColor: 'border-blue-500/30',
    buttonColor: 'bg-blue-500 hover:bg-blue-600',
    actionLabel: 'Enviar email',
  },
  facebook: {
    color: 'from-sky-500/20 to-sky-600/20',
    borderColor: 'border-sky-500/30',
    buttonColor: 'bg-sky-500 hover:bg-sky-600',
    actionLabel: 'Abrir perfil',
  },
  instagram: {
    color: 'from-pink-500/20 to-pink-600/20',
    borderColor: 'border-pink-500/30',
    buttonColor: 'bg-pink-500 hover:bg-pink-600',
    actionLabel: 'Abrir perfil',
  },
  form: {
    color: 'from-purple-500/20 to-purple-600/20',
    borderColor: 'border-purple-500/30',
    buttonColor: 'bg-purple-500 hover:bg-purple-600',
    actionLabel: 'Preencher formulário',
  },
};

function ContactCard({ contact, gmSlug }: { contact: ContactMethod; gmSlug: string }) {
  const [copied, setCopied] = useState(false);
  const { trackGmContactClick } = useTracking();
  const config = CHANNEL_CONFIG[contact.channel];
  const meta = CONTACT_CHANNEL_META[contact.channel];
  const Icon = meta.icon;
  const safeDiscordServerUrl = toSafeDiscordInviteUrl(contact.discord_server_url);

  // C4c (revisão adversarial Fase 4): timer do "Copiado!" por card, limpo no
  // unmount — antes o setTimeout era abandonado e setava estado em componente
  // já desmontado. Limpar o timer anterior a cada clique também garante os 2s
  // completos após o ÚLTIMO clique (o timer velho não reverte o novo).
  const copyResetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (copyResetTimer.current !== null) clearTimeout(copyResetTimer.current);
    },
    [],
  );

  const handleAction = () => {
    // Registrar tracking
    trackGmContactClick(gmSlug, contact.channel);

    if (contact.channel === 'whatsapp' || contact.channel === 'phone') {
      openSafeExternalUrl(toWhatsAppUrl(contact.value));
    } else if (contact.channel === 'email') {
      // Navegação só com endereço verificado: `mailto:` a partir de texto cru
      // aceitaria quebra de linha e forjaria cabeçalho no cliente de e-mail.
      const mailtoUrl = toSafeMailtoUrl(contact.value);
      if (mailtoUrl) window.location.href = mailtoUrl;
    } else if (contact.channel === 'discord') {
      // Copiar username
      navigator.clipboard.writeText(contact.value);
      setCopied(true);
      if (copyResetTimer.current !== null) clearTimeout(copyResetTimer.current);
      copyResetTimer.current = setTimeout(() => {
        setCopied(false);
        copyResetTimer.current = null;
      }, 2000);
    } else if (contact.channel === 'facebook' || contact.channel === 'instagram') {
      // Perfil só abre quando o host é da própria rede (toSafeSocialProfileUrl
      // recusa host estranho) — mesmo critério da validação de escrita.
      openSafeExternalUrl(toSafeSocialProfileUrl(contact.channel, contact.value));
    } else if (contact.channel === 'form') {
      openSafeExternalUrl(contact.value);
    }
  };

  const getActionLabel = () => {
    if (contact.channel === 'discord') return copied ? 'Copiado!' : config.actionLabel;
    return config.actionLabel;
  };

  // Formatar valor para exibição
  const displayValue = contact.channel === 'whatsapp' || contact.channel === 'phone'
    ? formatWhatsAppDisplay(contact.value)
    : contact.value;

  return (
    <div className={`p-5 rounded-[var(--radius-lg)] bg-gradient-to-br ${config.color} border ${config.borderColor}`}>
      <div className="flex items-start gap-4">
        {/* Ícone */}
        <div className={`flex-shrink-0 w-12 h-12 rounded-[var(--radius-pill)] bg-[var(--fill-10)] flex items-center justify-center`}>
          <Icon className={`w-6 h-6 ${meta.iconClass}`} />
        </div>

        {/* Conteúdo */}
        <div className="flex-1 min-w-0">
          <h3 className={`font-[var(--weight-strong)] ${meta.iconClass} mb-1`}>
            {contact.label || meta.label}
          </h3>

          {/* Valor com botão de copiar inline (para Discord) */}
          {contact.channel === 'discord' ? (
            <div className="flex items-center gap-2 mb-3">
              <p className="text-[length:var(--text-support)] leading-[var(--leading-support)] text-[var(--fg-soft)] break-all flex-1">
                {displayValue}
              </p>
              <button
                onClick={handleAction}
                className="flex-shrink-0 p-1.5 rounded hover:bg-[var(--fill-10)] transition"
                title="Copiar username"
              >
                {copied ? (
                  <Check className="w-4 h-4 text-green-400" />
                ) : (
                  <Copy className="w-4 h-4 text-[var(--fg-soft)]" />
                )}
              </button>
            </div>
          ) : (
            <p className="text-[length:var(--text-support)] leading-[var(--leading-support)] text-[var(--fg-soft)] mb-3 break-all">
              {displayValue}
            </p>
          )}

          {/* Botão de ação principal (não mostrar para Discord, já tem o inline) */}
          {contact.channel !== 'discord' && (
            <button
              onClick={handleAction}
              className={`
                inline-flex items-center gap-2 px-4 py-2 rounded-[var(--radius-md)]
                ${config.buttonColor} text-[var(--on-solid-fg)] text-[length:var(--text-support)] leading-[var(--leading-support)] font-[var(--weight-medium)] transition
              `}
            >
              {copied ? <Check className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
              {getActionLabel()}
            </button>
          )}

          {/* Botão do servidor Discord (se tiver) */}
          {contact.channel === 'discord' && safeDiscordServerUrl && (
            <a
              href={safeDiscordServerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-[var(--radius-md)] bg-indigo-600 hover:bg-indigo-700 text-[var(--on-solid-fg)] text-[length:var(--text-support)] leading-[var(--leading-support)] font-[var(--weight-medium)] transition"
            >
              <ExternalLink className="w-4 h-4" />
              Entrar no servidor
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

export function MestreContactMethods({ contacts, gmSlug }: MestreContactMethodsProps) {
  if (!contacts || contacts.length === 0) {
    return null;
  }

  return (
    <section className="space-y-4">
      <h2 className="text-[length:var(--text-title)] leading-[var(--leading-title)] font-[var(--weight-strong)] text-[var(--fg)]">Entre em Contato</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {contacts.map((contact, index) => (
          <ContactCard key={index} contact={contact} gmSlug={gmSlug} />
        ))}
      </div>
    </section>
  );
}
