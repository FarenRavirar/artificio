import { MessageCircle, MessageSquare, Mail, FileText, ExternalLink, HelpCircle, type LucideIcon } from 'lucide-react';
import type { TableContact } from '../../../types/tables';

interface TableContactsBlockProps {
  contacts: TableContact[];
}

/**
 * Bloco de contatos estilizado seguindo design system Artifício
 * Implementa botões full-width com cores semânticas e links de apoio
 */
export function TableContactsBlock({ contacts }: TableContactsBlockProps) {
  if (contacts.length === 0) return null;

  return (
    <div id="mesa-contato" className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-3">
      <h3 className="text-sm font-semibold text-white/90 uppercase tracking-wide">
        🎮 Como participar
      </h3>
      <div className="space-y-3">
        {contacts.map((contact, idx) => (
          <ContactButton key={idx} contact={contact} />
        ))}
      </div>
    </div>
  );
}

/**
 * Botão individual de contato com estilo por canal
 */
function ContactButton({ contact }: { contact: TableContact }) {
  const config = getChannelConfig(contact.channel);

  // Validar se value existe e não está vazio
  if (!contact.value || !contact.value.trim()) {
    console.warn(`[TableContactsBlock] Contato ${contact.channel} com value vazio ignorado`);
    return null;
  }

  // Discord: tratamento especial (username + servidor)
  if (contact.channel === 'discord') {
    return (
      <div className="space-y-2">
        {/* Botão principal: servidor Discord (se disponível) */}
        {contact.discord_server_url ? (
          <>
            <a
              href={contact.discord_server_url}
              target="_blank"
              rel="noopener noreferrer"
              className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl font-semibold text-white transition-all ${config.bg} shadow-lg hover:shadow-xl`}
            >
              <div className="flex items-center gap-3">
                <config.icon className="w-5 h-5" />
                <span>Entrar no servidor Discord</span>
              </div>
              <ExternalLink className="w-4 h-4 opacity-70" />
            </a>
            
            {/* Link abreviado do servidor */}
            <div className="flex items-center gap-2 px-2 text-xs">
              <span className="text-white/50">🔗</span>
              <a 
                href={contact.discord_server_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-400 hover:text-indigo-300 underline break-all"
              >
                {contact.discord_server_url}
              </a>
            </div>
          </>
        ) : (
          // Sem servidor: apenas mostrar username
          <div className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl ${config.bg} opacity-75`}>
            <config.icon className="w-5 h-5 text-white" />
            <span className="text-white font-semibold">Discord</span>
          </div>
        )}

        {/* Informação secundária: username */}
        <div className="flex items-start gap-2 px-2 text-sm text-white/70">
          <span className="text-white/50">👤</span>
          <div className="space-y-0.5">
            <p>
              Username: <span className="text-orange-400 font-medium">{contact.value}</span>
            </p>
            <p className="text-xs text-white/50">
              {contact.discord_server_url 
                ? 'Entre no servidor e envie mensagem direta' 
                : 'Envie mensagem direta no Discord'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Garantir que URL tenha protocolo
  const getValidUrl = (value: string): string => {
    // Se já tem protocolo, retornar como está
    if (value.startsWith('http://') || value.startsWith('https://')) {
      return value;
    }
    
    // WhatsApp: detectar número puro e formatar como wa.me
    if (contact.channel === 'whatsapp') {
      // Se já é wa.me sem protocolo
      if (value.startsWith('wa.me')) {
        return `https://${value}`;
      }
      // Se é apenas número (com ou sem +55)
      const cleanNumber = value.replace(/\D/g, ''); // Remove tudo que não é dígito
      if (cleanNumber.length >= 10) {
        // Se não tem código do país, adicionar +55 (Brasil)
        const fullNumber = cleanNumber.startsWith('55') ? cleanNumber : `55${cleanNumber}`;
        return `https://wa.me/${fullNumber}`;
      }
    }
    
    // Para outros casos, adicionar https://
    return `https://${value}`;
  };

  const validUrl = getValidUrl(contact.value);

  // WhatsApp: botão + link de ajuda + link abreviado
  if (contact.channel === 'whatsapp') {
    return (
      <div className="space-y-2">
        <a
          href={validUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl font-semibold text-white transition-all ${config.bg} shadow-lg hover:shadow-xl`}
        >
          <div className="flex items-center gap-3">
            <config.icon className="w-5 h-5" />
            <span>{config.label}</span>
          </div>
          <ExternalLink className="w-4 h-4 opacity-70" />
        </a>
        
        {/* Link abreviado visível */}
        <div className="flex items-center gap-2 px-2 text-xs">
          <span className="text-white/50">🔗</span>
          <a 
            href={validUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-green-400 hover:text-green-300 underline break-all"
          >
            {validUrl}
          </a>
        </div>
        
        {/* Link de apoio */}
        <div className="flex items-center gap-2 px-2 text-xs text-white/60">
          <HelpCircle className="w-3.5 h-3.5" />
          <span>Clique para abrir conversa direta no WhatsApp</span>
        </div>
      </div>
    );
  }

  // Outros canais: botão padrão
  return (
    <a
      href={validUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl font-semibold text-white transition-all ${config.bg} shadow-lg hover:shadow-xl`}
    >
      <div className="flex items-center gap-3">
        <config.icon className="w-5 h-5" />
        <span>{contact.label || config.label}</span>
      </div>
      <ExternalLink className="w-4 h-4 opacity-70" />
    </a>
  );
}

/**
 * Configuração de estilo e ícone por canal
 */
function getChannelConfig(channel: string) {
  const configs: Record<string, { bg: string; icon: LucideIcon; label: string }> = {
    whatsapp: {
      bg: 'bg-green-600 hover:bg-green-700',
      icon: MessageCircle,
      label: 'Enviar mensagem no WhatsApp',
    },
    discord: {
      bg: 'bg-indigo-600 hover:bg-indigo-700',
      icon: MessageSquare,
      label: 'Entrar no Discord',
    },
    email: {
      bg: 'bg-blue-600 hover:bg-blue-700',
      icon: Mail,
      label: 'Enviar e-mail',
    },
    form: {
      bg: 'bg-orange-600 hover:bg-orange-700',
      icon: FileText,
      label: 'Preencher formulário',
    },
    phone: {
      bg: 'bg-teal-600 hover:bg-teal-700',
      icon: MessageCircle,
      label: 'Ligar ou enviar SMS',
    },
    facebook: {
      bg: 'bg-blue-700 hover:bg-blue-800',
      icon: MessageSquare,
      label: 'Enviar mensagem no Facebook',
    },
    instagram: {
      bg: 'bg-pink-600 hover:bg-pink-700',
      icon: MessageSquare,
      label: 'Enviar mensagem no Instagram',
    },
  };

  return configs[channel.toLowerCase()] || {
    bg: 'bg-gray-600 hover:bg-gray-700',
    icon: ExternalLink,
    label: 'Acessar link',
  };
}
