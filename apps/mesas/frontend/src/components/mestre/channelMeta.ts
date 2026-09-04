import {
  Camera,
  ExternalLink,
  Hash,
  Mail,
  MessageCircle,
  Phone,
  ThumbsUp,
} from 'lucide-react';
import type { TableContactChannel } from '../../types/tables';

/**
 * Metadados dos 7 canais de contato — FONTE ÚNICA por canal (A1, revisão
 * adversarial Fase 4, spec 096). Antes label/ícone/placeholder viviam
 * triplicados em ContactMethodsEditor, MestreContactMethods e
 * ContactsFormBlock (removido na T4.8); cada um mantinha seu próprio mapa e
 * um canal novo exigia editar três lugares.
 *
 * O que fica aqui é a identidade compartilhada do canal: ícone, label
 * canônico, placeholder de edição, cor do ícone e rótulo do campo de valor.
 * O que NÃO fica (específico de cada tela):
 * - cores de exibição do card público (gradiente/borda/botão) e actionLabel —
 *   em MestreContactMethods (CHANNEL_CONFIG);
 * - hints de edição (URL alcançável, link do servidor Discord) — em
 *   ContactMethodsEditor.
 *
 * Ícones: lucide-react 1.21 não tem ícones de marca — Facebook usa ThumbsUp e
 * Instagram usa Camera (mesmo pictograma do editor antigo).
 */
// Cor de IDENTIDADE DE PLATAFORMA, não cor de tema (spec 100): o verde do
// WhatsApp e o roxo do Discord são a marca de terceiro — trocá-los por token
// semântico tiraria justamente o que identifica o canal. É a mesma exceção que
// o `#5865f2` do Discord e o `#4285f4` do Google já têm no `ProfileEditPage.css`.
// Por isso NÃO contam como violação do gate de cor literal.
export interface ContactChannelMeta {
  icon: typeof MessageCircle;
  label: string;
  placeholder: string;
  /** Classe completa (Tailwind não gera classes montadas em runtime). */
  iconClass: string;
  /** Rótulo do campo de valor para canal de URL. */
  valueLabel: string;
}

export const CONTACT_CHANNEL_META: Record<TableContactChannel, ContactChannelMeta> = {
  whatsapp: {
    icon: MessageCircle,
    label: 'WhatsApp',
    placeholder: '+5511999999999',
    iconClass: 'text-green-400',
    valueLabel: 'Valor',
  },
  discord: {
    icon: Hash,
    label: 'Discord',
    placeholder: '@usuario',
    iconClass: 'text-indigo-400',
    valueLabel: 'Valor',
  },
  phone: {
    icon: Phone,
    label: 'Telefone',
    placeholder: '(11) 99999-9999',
    iconClass: 'text-emerald-400',
    valueLabel: 'Valor',
  },
  email: {
    icon: Mail,
    label: 'Email',
    placeholder: 'seu@email.com',
    iconClass: 'text-blue-400',
    valueLabel: 'Valor',
  },
  facebook: {
    icon: ThumbsUp,
    label: 'Facebook',
    placeholder: 'facebook.com/seu-perfil',
    iconClass: 'text-sky-400',
    valueLabel: 'Valor',
  },
  instagram: {
    icon: Camera,
    label: 'Instagram',
    placeholder: 'instagram.com/seu-perfil',
    iconClass: 'text-pink-400',
    valueLabel: 'Valor',
  },
  form: {
    icon: ExternalLink,
    label: 'Formulário',
    placeholder: 'https://forms.google.com/...',
    iconClass: 'text-purple-400',
    valueLabel: 'URL do formulário',
  },
};
