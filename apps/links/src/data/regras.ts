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
    icon: "🚫",
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
    icon: "📢",
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
    icon: "🧾",
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
    icon: "🎭",
    title: "Assuntos off-topic",
    intro:
      "Se por algum motivo você quiser falar de algo fora de RPG de mesa, use a tag #OFFTOPIC. Assim evitamos que o grupo vire um feed caótico de mensagens aleatórias.",
  },
  {
    id: "etiqueta",
    icon: "🤝",
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
    icon: "📣",
    title: "Palavras finais",
    intro:
      "Aqui é um espaço para falarmos de RPG, trocarmos ideias e compartilharmos experiências. Não queremos tretas desnecessárias. Se todos jogarem as regras direitinho, ninguém precisa fazer uma salvaguarda de expulsão. Agora que você sabe as regras, seja bem-vindo e bora jogar!",
  },
  {
    id: "adicionais",
    icon: "🎲",
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
