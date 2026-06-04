import { Mail, MessageCircle, Hash, ExternalLink, Check, Copy } from 'lucide-react';
import { useState } from 'react';
import { useTracking } from '../../hooks/useTracking';

type ContactChannel = 'whatsapp' | 'email' | 'discord' | 'form';

interface ContactMethod {
  channel: ContactChannel;
  value: string;
  label?: string;
  discord_server_url?: string;
}

interface MestreContactMethodsProps {
  contacts: ContactMethod[];
  gmSlug: string;
}

const CHANNEL_CONFIG = {
  whatsapp: {
    icon: MessageCircle,
    label: 'WhatsApp',
    color: 'from-green-500/20 to-green-600/20',
    borderColor: 'border-green-500/30',
    textColor: 'text-green-400',
    buttonColor: 'bg-green-500 hover:bg-green-600',
  },
  email: {
    icon: Mail,
    label: 'Email',
    color: 'from-blue-500/20 to-blue-600/20',
    borderColor: 'border-blue-500/30',
    textColor: 'text-blue-400',
    buttonColor: 'bg-blue-500 hover:bg-blue-600',
  },
  discord: {
    icon: Hash,
    label: 'Discord',
    color: 'from-indigo-500/20 to-indigo-600/20',
    borderColor: 'border-indigo-500/30',
    textColor: 'text-indigo-400',
    buttonColor: 'bg-indigo-500 hover:bg-indigo-600',
  },
  form: {
    icon: ExternalLink,
    label: 'Formulário',
    color: 'from-purple-500/20 to-purple-600/20',
    borderColor: 'border-purple-500/30',
    textColor: 'text-purple-400',
    buttonColor: 'bg-purple-500 hover:bg-purple-600',
  },
};

// Formatar WhatsApp para exibição: +5563992681119 → (63) 99268-1119
function formatWhatsAppDisplay(value: string): string {
  // Remover o +55 do início
  const withoutCountry = value.replace(/^\+55/, '');
  
  // Extrair DDD (2 dígitos) e número (9 ou 8 dígitos)
  const ddd = withoutCountry.slice(0, 2);
  const numero = withoutCountry.slice(2);
  
  // Formatar número: 99268-1119 ou 9268-1119
  if (numero.length === 9) {
    // Celular com 9 dígitos: 99268-1119
    return `(${ddd}) ${numero.slice(0, 5)}-${numero.slice(5)}`;
  } else if (numero.length === 8) {
    // Fixo com 8 dígitos: 9268-1119
    return `(${ddd}) ${numero.slice(0, 4)}-${numero.slice(4)}`;
  }
  
  // Fallback: retornar original se não conseguir formatar
  return value;
}

function ContactCard({ contact, gmSlug }: { contact: ContactMethod; gmSlug: string }) {
  const [copied, setCopied] = useState(false);
  const { trackGmContactClick } = useTracking();
  const config = CHANNEL_CONFIG[contact.channel];
  const Icon = config.icon;

  const handleAction = () => {
    // Registrar tracking
    trackGmContactClick(gmSlug, contact.channel);

    if (contact.channel === 'whatsapp') {
      const cleanNumber = contact.value.replace(/\D/g, '');
      window.open(`https://wa.me/${cleanNumber}`, '_blank');
    } else if (contact.channel === 'email') {
      window.location.href = `mailto:${contact.value}`;
    } else if (contact.channel === 'discord') {
      // Copiar username
      navigator.clipboard.writeText(contact.value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } else if (contact.channel === 'form') {
      window.open(contact.value, '_blank');
    }
  };

  const getActionLabel = () => {
    if (contact.channel === 'whatsapp') return 'Enviar mensagem';
    if (contact.channel === 'email') return 'Enviar email';
    if (contact.channel === 'discord') return copied ? 'Copiado!' : 'Copiar username';
    if (contact.channel === 'form') return 'Preencher formulário';
    return 'Contatar';
  };

  // Formatar valor para exibição
  const displayValue = contact.channel === 'whatsapp' 
    ? formatWhatsAppDisplay(contact.value)
    : contact.value;

  return (
    <div className={`p-5 rounded-xl bg-gradient-to-br ${config.color} border ${config.borderColor}`}>
      <div className="flex items-start gap-4">
        {/* Ícone */}
        <div className={`flex-shrink-0 w-12 h-12 rounded-full bg-white/10 flex items-center justify-center`}>
          <Icon className={`w-6 h-6 ${config.textColor}`} />
        </div>

        {/* Conteúdo */}
        <div className="flex-1 min-w-0">
          <h3 className={`font-bold ${config.textColor} mb-1`}>
            {contact.label || config.label}
          </h3>
          
          {/* Valor com botão de copiar inline (para Discord) */}
          {contact.channel === 'discord' ? (
            <div className="flex items-center gap-2 mb-3">
              <p className="text-sm text-white/70 break-all flex-1">
                {displayValue}
              </p>
              <button
                onClick={handleAction}
                className="flex-shrink-0 p-1.5 rounded hover:bg-white/10 transition"
                title="Copiar username"
              >
                {copied ? (
                  <Check className="w-4 h-4 text-green-400" />
                ) : (
                  <Copy className="w-4 h-4 text-white/70" />
                )}
              </button>
            </div>
          ) : (
            <p className="text-sm text-white/70 mb-3 break-all">
              {displayValue}
            </p>
          )}

          {/* Botão de ação principal (não mostrar para Discord, já tem o inline) */}
          {contact.channel !== 'discord' && (
            <button
              onClick={handleAction}
              className={`
                inline-flex items-center gap-2 px-4 py-2 rounded-lg
                ${config.buttonColor} text-white text-sm font-medium transition
              `}
            >
              {copied ? <Check className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
              {getActionLabel()}
            </button>
          )}

          {/* Botão do servidor Discord (se tiver) */}
          {contact.channel === 'discord' && contact.discord_server_url && (
            <a
              href={contact.discord_server_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition"
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
      <h2 className="text-2xl font-bold text-white">📬 Entre em Contato</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {contacts.map((contact, index) => (
          <ContactCard key={index} contact={contact} gmSlug={gmSlug} />
        ))}
      </div>
    </section>
  );
}
