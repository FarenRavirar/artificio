import { useState } from 'react';
import { ChevronDown, ChevronUp, Sparkles, TrendingUp, Users, Zap, Image, BookOpen, MessageSquare, GitBranch } from 'lucide-react';

interface HelpSection {
  id: string;
  icon: React.ReactNode;
  title: string;
  content: React.ReactNode;
}

export function HelpCenter() {
  const [openSection, setOpenSection] = useState<string | null>('cta-dinamico');

  const sections: HelpSection[] = [
    {
      id: 'cta-dinamico',
      icon: <Sparkles className="w-5 h-5" />,
      title: 'Como funciona o CTA dinâmico do seu perfil',
      content: (
        <div className="space-y-4">
          <p className="text-white/70 leading-relaxed">
            Seu perfil público exibe um <strong>Call-to-Action (CTA) inteligente</strong> que se adapta automaticamente 
            à disponibilidade das suas mesas. Isso ajuda a converter mais visitantes em jogadores.
          </p>

          <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-3">
            <h4 className="font-semibold text-white flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[var(--color-artificio-orange)]" />
              Cenários automáticos
            </h4>
            
            <div className="space-y-3">
              <div className="flex gap-3 items-start">
                <span className="text-2xl">📋</span>
                <div className="flex-1">
                  <p className="font-medium text-white">Lista de espera disponível</p>
                  <p className="text-sm text-white/50">Quando: 0 vagas abertas</p>
                  <p className="text-xs text-white/40 mt-1">Mantém o interesse mesmo com mesas lotadas</p>
                </div>
              </div>

              <div className="flex gap-3 items-start">
                <span className="text-2xl">🔥</span>
                <div className="flex-1">
                  <p className="font-medium text-white">Últimas vagas disponíveis</p>
                  <p className="text-sm text-white/50">Quando: Mesa urgente (≤2 vagas) OU 75%+ ocupado</p>
                  <p className="text-xs text-white/40 mt-1">Cria senso de urgência para conversão rápida</p>
                </div>
              </div>

              <div className="flex gap-3 items-start">
                <span className="text-2xl">⚡</span>
                <div className="flex-1">
                  <p className="font-medium text-white">Vagas preenchendo rápido</p>
                  <p className="text-sm text-white/50">Quando: 50-74% ocupado</p>
                  <p className="text-xs text-white/40 mt-1">Incentiva ação sem pressão excessiva</p>
                </div>
              </div>

              <div className="flex gap-3 items-start">
                <span className="text-2xl">✨</span>
                <div className="flex-1">
                  <p className="font-medium text-white">Vagas abertas para novas aventuras</p>
                  <p className="text-sm text-white/50">Quando: Menos de 50% ocupado</p>
                  <p className="text-xs text-white/40 mt-1">Tom acolhedor para novos jogadores</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
            <p className="text-sm text-blue-200/90 leading-relaxed">
              <strong>💡 Dica:</strong> O sistema calcula automaticamente a taxa de ocupação do seu portfólio. 
              Quanto mais mesas você tiver ativas, mais preciso será o CTA exibido.
            </p>
          </div>
        </div>
      ),
    },
    {
      id: 'otimizar-perfil',
      icon: <Users className="w-5 h-5" />,
      title: 'Otimizando seu perfil para mais jogadores',
      content: (
        <div className="space-y-4">
          <p className="text-white/70 leading-relaxed">
            Um perfil bem estruturado aumenta significativamente suas chances de atrair jogadores. 
            Siga estas práticas recomendadas:
          </p>

          <div className="space-y-3">
            <div className="bg-white/5 border border-white/10 rounded-xl p-4">
              <h4 className="font-semibold text-white mb-2">✅ Avatar e Banner</h4>
              <p className="text-sm text-white/60 leading-relaxed">
                Use imagens de alta qualidade que representem seu estilo de mestrar. 
                O avatar aparece em todas as suas mesas, enquanto o banner define a primeira impressão do seu perfil.
              </p>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-xl p-4">
              <h4 className="font-semibold text-white mb-2">✅ Bio e Tagline</h4>
              <p className="text-sm text-white/60 leading-relaxed">
                A tagline é sua "chamada" principal (máx. 120 caracteres). 
                A bio longa deve detalhar sua experiência, estilo de jogo e o que torna suas mesas únicas.
              </p>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-xl p-4">
              <h4 className="font-semibold text-white mb-2">✅ Pontos de Venda</h4>
              <p className="text-sm text-white/60 leading-relaxed">
                Use os "Selling Points" para destacar diferenciais: anos de experiência, sistemas dominados, 
                estilo narrativo, suporte a iniciantes, etc.
              </p>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-xl p-4">
              <h4 className="font-semibold text-white mb-2">✅ Links de Contato</h4>
              <p className="text-sm text-white/60 leading-relaxed">
                Adicione Discord, WhatsApp ou outros canais de contato. 
                Quanto mais fácil for te encontrar, maior a taxa de conversão.
              </p>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 'gerenciar-vagas',
      icon: <Zap className="w-5 h-5" />,
      title: 'Gerenciando vagas e disponibilidade',
      content: (
        <div className="space-y-4">
          <p className="text-white/70 leading-relaxed">
            A gestão eficiente de vagas mantém seu perfil sempre relevante e aumenta a visibilidade das suas mesas.
          </p>

          <div className="space-y-3">
            <div className="bg-white/5 border border-white/10 rounded-xl p-4">
              <h4 className="font-semibold text-white mb-2">🎯 Mantenha mesas ativas atualizadas</h4>
              <p className="text-sm text-white/60 leading-relaxed">
                Quando uma vaga for preenchida, atualize o número de vagas ocupadas imediatamente. 
                Isso garante que o CTA dinâmico reflita a realidade e evita frustrações.
              </p>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-xl p-4">
              <h4 className="font-semibold text-white mb-2">🎯 Desative mesas lotadas</h4>
              <p className="text-sm text-white/60 leading-relaxed">
                Quando uma mesa estiver completamente cheia, altere o status para "Lotada" ou "Cancelada". 
                Isso remove a mesa da listagem pública e melhora a experiência dos visitantes.
              </p>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-xl p-4">
              <h4 className="font-semibold text-white mb-2">🎯 Crie mesas com antecedência</h4>
              <p className="text-sm text-white/60 leading-relaxed">
                Publique mesas novas assim que tiver datas confirmadas. 
                Isso mantém seu perfil sempre com opções disponíveis e aumenta a taxa de ocupação.
              </p>
            </div>
          </div>

          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
            <p className="text-sm text-amber-200/90 leading-relaxed">
              <strong>⚠️ Importante:</strong> Perfis com mesas desatualizadas ou informações incorretas 
              podem ter menor visibilidade na plataforma.
            </p>
          </div>
        </div>
      ),
    },
    {
      id: 'interpretar-metricas',
      icon: <TrendingUp className="w-5 h-5" />,
      title: 'Interpretando suas métricas de desempenho',
      content: (
        <div className="space-y-4">
          <p className="text-white/70 leading-relaxed">
            O painel exibe métricas de engajamento que ajudam você a entender o desempenho das suas mesas. 
            Veja como interpretar cada indicador:
          </p>

          <div className="space-y-3">
            <div className="bg-white/5 border border-white/10 rounded-xl p-4">
              <h4 className="font-semibold text-white mb-2">👁️ Visualizações</h4>
              <p className="text-sm text-white/60 leading-relaxed mb-2">
                <strong>O que é:</strong> Número total de vezes que suas mesas foram visualizadas por visitantes.
              </p>
              <p className="text-sm text-white/60 leading-relaxed mb-2">
                <strong>Como é calculado:</strong> Soma de todas as visualizações de todas as suas mesas ativas.
              </p>
              <p className="text-sm text-white/50 leading-relaxed">
                <strong>Como melhorar:</strong> Otimize títulos e descrições, use imagens atrativas, 
                mantenha mesas ativas atualizadas e diversifique sistemas/horários.
              </p>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-xl p-4">
              <h4 className="font-semibold text-white mb-2">💬 Contatos</h4>
              <p className="text-sm text-white/60 leading-relaxed mb-2">
                <strong>O que é:</strong> Número de vezes que jogadores clicaram em seus canais de contato 
                (Discord, WhatsApp, etc.) a partir das suas mesas.
              </p>
              <p className="text-sm text-white/60 leading-relaxed mb-2">
                <strong>Como é calculado:</strong> Soma de todos os cliques em links de contato de todas as suas mesas.
              </p>
              <p className="text-sm text-white/50 leading-relaxed">
                <strong>Como melhorar:</strong> Adicione múltiplos canais de contato, use CTAs claros nas descrições, 
                responda rapidamente às mensagens.
              </p>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-xl p-4">
              <h4 className="font-semibold text-white mb-2">📈 Taxa de Conversão</h4>
              <p className="text-sm text-white/60 leading-relaxed mb-2">
                <strong>O que é:</strong> Percentual de visitantes que clicaram em seus contatos após visualizar suas mesas.
              </p>
              <p className="text-sm text-white/60 leading-relaxed mb-2">
                <strong>Como é calculado:</strong> (Total de Contatos ÷ Total de Visualizações) × 100
              </p>
              <div className="bg-white/5 border border-white/10 rounded p-3 mt-2 space-y-1">
                <p className="text-xs text-white/50">
                  <strong>Referência de mercado:</strong>
                </p>
                <p className="text-xs text-white/40">• Abaixo de 5%: Revise descrições e imagens</p>
                <p className="text-xs text-white/40">• 5-10%: Desempenho médio</p>
                <p className="text-xs text-white/40">• 10-20%: Bom desempenho</p>
                <p className="text-xs text-white/40">• Acima de 20%: Excelente desempenho</p>
              </div>
            </div>
          </div>

          <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
            <p className="text-sm text-blue-200/90 leading-relaxed">
              <strong>💡 Dica:</strong> Métricas são atualizadas em tempo real. 
              Compare o desempenho entre diferentes mesas para identificar o que funciona melhor 
              (sistemas, horários, estilos de descrição).
            </p>
          </div>

          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
            <p className="text-sm text-amber-200/90 leading-relaxed">
              <strong>⚠️ Nota:</strong> Métricas individuais por mesa estão em desenvolvimento. 
              Em breve você poderá ver o desempenho detalhado de cada anúncio separadamente.
            </p>
          </div>
        </div>
      ),
    },
    {
      id: 'criar-mesas',
      icon: <BookOpen className="w-5 h-5" />,
      title: 'Criando mesas que atraem jogadores',
      content: (
        <div className="space-y-4">
          <p className="text-white/70 leading-relaxed">
            A forma como você descreve suas mesas impacta diretamente na taxa de inscrição. 
            Siga estas práticas para criar anúncios eficazes:
          </p>

          <div className="space-y-3">
            <div className="bg-white/5 border border-white/10 rounded-xl p-4">
              <h4 className="font-semibold text-white mb-2">📝 Título claro e atrativo</h4>
              <p className="text-sm text-white/60 leading-relaxed mb-2">
                Use títulos que comuniquem o tema e o tom da mesa. Evite títulos genéricos como "Mesa de D&D".
              </p>
              <div className="bg-green-500/10 border border-green-500/20 rounded p-2 text-xs text-green-200">
                <strong>✅ Bom:</strong> "A Maldição de Strahd - Horror gótico para jogadores experientes"
              </div>
              <div className="bg-red-500/10 border border-red-500/20 rounded p-2 text-xs text-red-200 mt-2">
                <strong>❌ Evite:</strong> "Mesa de D&D 5e"
              </div>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-xl p-4">
              <h4 className="font-semibold text-white mb-2">📝 Descrição detalhada</h4>
              <p className="text-sm text-white/60 leading-relaxed">
                Inclua: premissa da campanha, tom/estilo de jogo, expectativas (roleplay vs combate), 
                frequência das sessões, duração estimada e requisitos (iniciantes aceitos ou não).
              </p>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-xl p-4">
              <h4 className="font-semibold text-white mb-2">📝 Escolha do cenário</h4>
              <p className="text-sm text-white/60 leading-relaxed mb-2">
                Cenários populares atraem mais jogadores, mas cenários únicos podem destacar seu perfil:
              </p>
              <ul className="text-sm text-white/50 space-y-1 ml-4">
                <li>• <strong>Forgotten Realms:</strong> Mais popular, maior alcance</li>
                <li>• <strong>Eberron:</strong> Público nichado, mas engajado</li>
                <li>• <strong>Homebrew:</strong> Destaque criativo, explique bem o mundo</li>
                <li>• <strong>Aventuras oficiais:</strong> Facilita recrutamento de iniciantes</li>
              </ul>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-xl p-4">
              <h4 className="font-semibold text-white mb-2">📝 Modalidade e horários</h4>
              <p className="text-sm text-white/60 leading-relaxed">
                Seja específico sobre modalidade (presencial/online) e horários. 
                Mesas com horários flexíveis ou finais de semana tendem a preencher mais rápido.
              </p>
            </div>
          </div>

          <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
            <p className="text-sm text-blue-200/90 leading-relaxed">
              <strong>💡 Dica:</strong> Mesas com descrições completas e imagens atrativas têm 3x mais chances 
              de preencher todas as vagas na primeira semana.
            </p>
          </div>
        </div>
      ),
    },
    {
      id: 'escolha-imagens',
      icon: <Image className="w-5 h-5" />,
      title: 'Escolhendo imagens profissionais',
      content: (
        <div className="space-y-4">
          <p className="text-white/70 leading-relaxed">
            Imagens de qualidade aumentam significativamente a credibilidade do seu perfil e das suas mesas. 
            Siga estas diretrizes:
          </p>

          <div className="space-y-3">
            <div className="bg-white/5 border border-white/10 rounded-xl p-4">
              <h4 className="font-semibold text-white mb-2">🖼️ Avatar do perfil</h4>
              <p className="text-sm text-white/60 leading-relaxed mb-2">
                Seu avatar aparece em todas as suas mesas. Use uma imagem que represente você ou seu estilo:
              </p>
              <ul className="text-sm text-white/50 space-y-1 ml-4">
                <li>• <strong>Resolução mínima:</strong> 400x400px (quadrada)</li>
                <li>• <strong>Formato:</strong> JPG, PNG ou WebP</li>
                <li>• <strong>Conteúdo:</strong> Foto pessoal, logo, ou arte temática</li>
                <li>• <strong>Evite:</strong> Imagens pixeladas, memes ou conteúdo ofensivo</li>
              </ul>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-xl p-4">
              <h4 className="font-semibold text-white mb-2">🖼️ Banner do perfil</h4>
              <p className="text-sm text-white/60 leading-relaxed mb-2">
                O banner é a primeira impressão do seu perfil. Use imagens panorâmicas de alta qualidade:
              </p>
              <ul className="text-sm text-white/50 space-y-1 ml-4">
                <li>• <strong>Resolução recomendada:</strong> 1920x400px (proporção 16:3)</li>
                <li>• <strong>Tema:</strong> Arte de RPG, cenários épicos, ou composições temáticas</li>
                <li>• <strong>Texto:</strong> Evite texto na imagem (use a tagline para isso)</li>
              </ul>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-xl p-4">
              <h4 className="font-semibold text-white mb-2">🖼️ Imagens de mesas</h4>
              <p className="text-sm text-white/60 leading-relaxed mb-2">
                Cada mesa pode ter uma imagem de capa. Use arte que represente o tema da campanha:
              </p>
              <ul className="text-sm text-white/50 space-y-1 ml-4">
                <li>• <strong>Resolução mínima:</strong> 800x600px</li>
                <li>• <strong>Fontes gratuitas:</strong> Unsplash, Pexels, ArtStation (com licença)</li>
                <li>• <strong>Direitos autorais:</strong> Use apenas imagens com licença comercial ou de uso livre</li>
              </ul>
            </div>
          </div>

          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
            <p className="text-sm text-amber-200/90 leading-relaxed">
              <strong>⚠️ Importante:</strong> Não use imagens protegidas por direitos autorais sem permissão. 
              Perfis com violações podem ser suspensos.
            </p>
          </div>
        </div>
      ),
    },
    {
      id: 'sistemas-populares',
      icon: <Sparkles className="w-5 h-5" />,
      title: 'Sistemas populares e como escolher',
      content: (
        <div className="space-y-4">
          <p className="text-white/70 leading-relaxed">
            A escolha do sistema impacta diretamente no público que você atrai. 
            Conheça os sistemas mais populares na plataforma:
          </p>

          <div className="space-y-3">
            <div className="bg-white/5 border border-white/10 rounded-xl p-4">
              <h4 className="font-semibold text-white mb-2">🎲 D&D 5ª Edição</h4>
              <p className="text-sm text-white/60 leading-relaxed">
                <strong>Popularidade:</strong> ⭐⭐⭐⭐⭐ (Maior base de jogadores)<br />
                <strong>Complexidade:</strong> Média<br />
                <strong>Ideal para:</strong> Iniciantes e veteranos. Maior alcance de público.<br />
                <strong>Dica:</strong> Especifique se aceita homebrew e quais livros são permitidos.
              </p>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-xl p-4">
              <h4 className="font-semibold text-white mb-2">🎲 Pathfinder 2e</h4>
              <p className="text-sm text-white/60 leading-relaxed">
                <strong>Popularidade:</strong> ⭐⭐⭐⭐ (Público engajado)<br />
                <strong>Complexidade:</strong> Alta<br />
                <strong>Ideal para:</strong> Jogadores que buscam profundidade tática e customização.<br />
                <strong>Dica:</strong> Deixe claro o nível de otimização esperado.
              </p>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-xl p-4">
              <h4 className="font-semibold text-white mb-2">🎲 Call of Cthulhu</h4>
              <p className="text-sm text-white/60 leading-relaxed">
                <strong>Popularidade:</strong> ⭐⭐⭐ (Nicho de horror)<br />
                <strong>Complexidade:</strong> Baixa a Média<br />
                <strong>Ideal para:</strong> Jogadores que preferem investigação e horror psicológico.<br />
                <strong>Dica:</strong> Especifique a época (anos 20, moderno, etc.).
              </p>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-xl p-4">
              <h4 className="font-semibold text-white mb-2">🎲 Tormenta20</h4>
              <p className="text-sm text-white/60 leading-relaxed">
                <strong>Popularidade:</strong> ⭐⭐⭐⭐ (Forte no Brasil)<br />
                <strong>Complexidade:</strong> Média<br />
                <strong>Ideal para:</strong> Público brasileiro que busca sistema nacional.<br />
                <strong>Dica:</strong> Destaque se usa regras oficiais ou adaptações.
              </p>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-xl p-4">
              <h4 className="font-semibold text-white mb-2">🎲 Outros sistemas</h4>
              <p className="text-sm text-white/60 leading-relaxed">
                Sistemas como <strong>Fate, Savage Worlds, Blades in the Dark, Vampiro: A Máscara</strong> 
                têm públicos menores mas extremamente engajados. Se você domina um sistema nichado, 
                destaque isso no seu perfil para atrair jogadores específicos.
              </p>
            </div>
          </div>

          <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
            <p className="text-sm text-blue-200/90 leading-relaxed">
              <strong>💡 Dica:</strong> Mestres que dominam múltiplos sistemas tendem a ter maior taxa de ocupação. 
              Considere diversificar seu portfólio.
            </p>
          </div>
        </div>
      ),
    },
    {
      id: 'reportar-problemas',
      icon: <GitBranch className="w-5 h-5" />,
      title: 'Como reportar bugs e sugerir melhorias',
      content: (
        <div className="space-y-4">
          <p className="text-white/70 leading-relaxed">
            Sua contribuição é essencial para melhorar a plataforma. 
            Veja como reportar problemas ou sugerir novas funcionalidades:
          </p>

          <div className="space-y-3">
            <div className="bg-white/5 border border-white/10 rounded-xl p-4">
              <h4 className="font-semibold text-white mb-2 flex items-center gap-2">
                <GitBranch className="w-4 h-4" />
                Reportando bugs
              </h4>
              <p className="text-sm text-white/60 leading-relaxed mb-2">
                Encontrou um erro ou comportamento inesperado? Abra uma issue no GitHub:
              </p>
              <ol className="text-sm text-white/50 space-y-2 ml-4 list-decimal">
                <li>Acesse: <a href="https://github.com/FarenRavirar/mesas_rpg_artificio/issues" target="_blank" rel="noopener noreferrer" className="text-[var(--color-artificio-orange)] hover:underline">github.com/FarenRavirar/mesas_rpg_artificio/issues</a></li>
                <li>Clique em <strong>"New Issue"</strong></li>
                <li>Escolha o template <strong>"Bug Report"</strong></li>
                <li>Descreva: o que você esperava vs o que aconteceu</li>
                <li>Inclua: navegador, sistema operacional e prints (se possível)</li>
              </ol>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-xl p-4">
              <h4 className="font-semibold text-white mb-2 flex items-center gap-2">
                <MessageSquare className="w-4 h-4" />
                Sugerindo melhorias
              </h4>
              <p className="text-sm text-white/60 leading-relaxed mb-2">
                Tem uma ideia para melhorar a plataforma? Compartilhe conosco:
              </p>
              <ol className="text-sm text-white/50 space-y-2 ml-4 list-decimal">
                <li>Acesse o mesmo link do GitHub Issues</li>
                <li>Escolha o template <strong>"Feature Request"</strong></li>
                <li>Descreva: qual problema a funcionalidade resolve</li>
                <li>Explique: como você imagina que funcionaria</li>
                <li>Adicione: exemplos de outras plataformas (se aplicável)</li>
              </ol>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-xl p-4">
              <h4 className="font-semibold text-white mb-2">📋 Boas práticas</h4>
              <ul className="text-sm text-white/50 space-y-1 ml-4">
                <li>• <strong>Seja específico:</strong> Quanto mais detalhes, melhor</li>
                <li>• <strong>Um problema por issue:</strong> Não misture múltiplos bugs/sugestões</li>
                <li>• <strong>Busque antes:</strong> Verifique se já não existe uma issue similar</li>
                <li>• <strong>Seja respeitoso:</strong> Mantenha o tom profissional e construtivo</li>
              </ul>
            </div>
          </div>

          <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4">
            <p className="text-sm text-green-200/90 leading-relaxed">
              <strong>✅ Agradecemos sua contribuição!</strong> Todas as issues são revisadas pela equipe. 
              Issues bem documentadas têm prioridade no roadmap de desenvolvimento.
            </p>
          </div>
        </div>
      ),
    },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-extrabold">Central de Ajuda</h1>
        <p className="text-white/50">
          Aprenda a otimizar seu perfil e atrair mais jogadores para suas mesas
        </p>
      </div>

      <div className="space-y-3">
        {sections.map((section) => {
          const isOpen = openSection === section.id;
          
          return (
            <div
              key={section.id}
              className="bg-white/5 border border-white/10 rounded-xl overflow-hidden transition-all"
            >
              <button
                onClick={() => setOpenSection(isOpen ? null : section.id)}
                className="w-full flex items-center justify-between p-5 text-left hover:bg-white/5 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="text-[var(--color-artificio-orange)]">
                    {section.icon}
                  </div>
                  <h3 className="font-semibold text-white">{section.title}</h3>
                </div>
                {isOpen ? (
                  <ChevronUp className="w-5 h-5 text-white/40" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-white/40" />
                )}
              </button>
              
              {isOpen && (
                <div className="px-5 pb-5 pt-2 border-t border-white/10">
                  {section.content}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="bg-gradient-to-r from-[var(--color-artificio-orange)]/10 to-purple-500/10 border border-[var(--color-artificio-orange)]/20 rounded-xl p-6 text-center">
        <p className="text-white/80 leading-relaxed">
          <strong>Precisa de mais ajuda?</strong> Entre em contato conosco através dos canais oficiais 
          ou consulte a documentação completa no nosso site.
        </p>
      </div>
    </div>
  );
}
