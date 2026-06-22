// Regras dos grupos do Artifício RPG.
// Fonte: https://artificiorpg.com/grupos-de-whatsapp-de-rpg-de-mesa/ (extraído 2026-06-20).

export interface RegraItem {
  /** texto em destaque (negrito) no início do item, opcional */
  strong?: string;
  text: string;
}

export interface RegraSection {
  id: string;
  /** emoji/ícone do título, opcional */
  icon?: string;
  title: string;
  /** parágrafo introdutório, opcional */
  intro?: string;
  items?: RegraItem[];
}

export const REGRAS_INTRO =
  "Este grupo é sobre RPG de mesa. Qualquer assunto que fuja desse tema está sujeito a advertência, e insistir nisso pode levar a banimento. Se quiser discutir outros assuntos sem regras, vá para o Porão do Dungeon, onde a única regra é NÃO COMETER CRIMES.";

export const REGRAS_SECTIONS: RegraSection[] = [
  {
    id: "proibido",
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>`,
    title: "O que é terminantemente proibido",
    items: [
      {
        strong: "Pirataria.",
        text: "Não interessa se é livro, módulo, suplemento ou PDF do grimório proibido. Pirataria aqui é banimento imediato.",
      },
      {
        strong: "Conteúdo NSFW.",
        text: "(Not Safe for Work). Se for indecente, inapropriado ou coisa de cantinho escuro da internet, é ban automático.",
      },
      {
        strong: "Fomentar cartel de D&D.",
        text: "Sim, estamos de olho. Se começar a conspirar para monopolizar D&D, o grupo vai contra-atacar.",
      },
      {
        strong: "Justificar estupro.",
        text: "Se isso precisa ser explicado, você já não deveria estar aqui. Ban instantâneo.",
      },
      {
        strong: "Comportamento incel.",
        text: "Se vier com esse papo, você será expurgado como um goblin inconveniente.",
      },
      {
        strong: "Três níveis de Guerreiro.",
        text: "Não sabemos exatamente por quê, mas já foi decretado: três níveis de Guerreiro é ban.",
      },
    ],
  },
  {
    id: "divulgacao",
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 11L21 6v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/></svg>`,
    title: "Divulgação — política e formato",
    intro:
      "Divulgação é permitida somente sobre RPG de mesa. No início do post, use uma das tags: [DIVULGA] para conteúdos e eventos (notícias, lançamentos, artigos, vídeos, streams, editais, playtests); [MESA] para recrutamento de campanhas e one-shots; [SERVIÇO] para serviços remunerados (mestre de aluguel, arte, revisão, diagramação, comissionados).",
    items: [
      {
        strong: "Frequência:",
        text: "até 1 post por dia por pessoa; o mesmo item no máximo 1 vez por semana.",
      },
      {
        strong: "Formato (checklist):",
        text: "Título curto → O que é (1 frase) → Para quem → Quando/onde (se houver) → Link único → 1 imagem opcional.",
      },
    ],
  },
  {
    id: "vendas",
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/></svg>`,
    title: "Vendas / trocas — seção própria",
    intro: "Publicações de venda/troca devem seguir os critérios abaixo:",
    items: [
      { strong: "Frequência:", text: "1 post consolidado por semana por vendedor." },
      { strong: "Volume:", text: "máximo de 10 itens por post." },
      {
        strong: "Formato por item (linha única):",
        text: "Título · R$ valor · Tipo de vendedor (física/empresa/sebo/revenda/arquivo pessoal) · Formato/estado · Local/envio · Contato/link.",
      },
      {
        strong: "Legalidade:",
        text: "somente itens com procedência e licença. Materiais piratas ou sem autorização serão removidos e o autor banido.",
      },
    ],
  },
  {
    id: "offtopic",
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/><line x1="10" y1="3" x2="8" y2="21"/><line x1="16" y1="3" x2="14" y2="21"/></svg>`,
    title: "Assuntos off-topic",
    intro:
      "Se por algum motivo você quiser falar de algo fora de RPG de mesa, use a tag #OFFTOPIC. Assim evitamos que o grupo vire um feed caótico de mensagens aleatórias.",
  },
  {
    id: "etiqueta",
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 12h1a1 1 0 0 1 1 1v5l-3 2H7l-2-3v-4l1.5-2"/><path d="M13 12h-1a1 1 0 0 0-1 1v5l3 2h3l2-3v-4l-1.5-2"/><path d="M9 12V9a3 3 0 0 1 6 0v3"/></svg>`,
    title: "Etiqueta do grupo",
    items: [
      {
        strong: "Tenha bom senso",
        text: "em tudo, incluindo links e figurinhas. Máximo de duas figurinhas seguidas.",
      },
      {
        strong: "Não alimente discussões inúteis.",
        text: "Se alguém está falando bobagem, ignorar pode ser mais eficaz do que discutir.",
      },
    ],
  },
  {
    id: "finais",
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>`,
    title: "Palavras finais",
    intro:
      "Aqui é um espaço para falarmos de RPG, trocarmos ideias e compartilharmos experiências. Não queremos tretas desnecessárias. Se todos jogarem as regras direitinho, ninguém precisa fazer uma salvaguarda de expulsão. Agora que você sabe as regras, seja bem-vindo e bora jogar!",
  },
  {
    id: "adicionais",
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r=".5" fill="currentColor"/><circle cx="15.5" cy="15.5" r=".5" fill="currentColor"/></svg>`,
    title: "Regras adicionais",
    items: [
      { text: "Não pode bilisca." },
      { text: "Não pode chutá ou mostra a lingua." },
      { text: "Não pode dizer que vai matá os colega." },
      { text: "Não pode ficar imburradu." },
      { text: "Não pode apilhidar os colega." },
      { text: "Não pode implicá com os colegas." },
    ],
  },
];
