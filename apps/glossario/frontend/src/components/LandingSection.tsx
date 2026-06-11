import { Link } from 'react-router-dom';
import { BookOpen, Users, Globe, Heart } from 'lucide-react';

interface LandingSectionProps {
  totalTermos: number;
}

export function LandingSection({ totalTermos }: LandingSectionProps) {
  return (
    <div className="w-full">
      {/* Hero */}
      <section className="text-center py-2 px-4">
        <h2 className="text-4xl md:text-5xl font-black text-azul-escuro uppercase tracking-tighter leading-tight mb-4">
          O Grande Glossário<br/>
          <span className="text-laranja">de RPG de Mesa</span>
        </h2>

        <p className="text-gray-600 text-lg max-w-2xl mx-auto mb-3 leading-relaxed">
          A maior base colaborativa de tradução bilíngue para RPG em português.
          Por enquanto, com foco no vasto acervo de <strong>D&D 5e</strong> — mas feito
          para crescer com a comunidade, abrangendo qualquer sistema ou cenário.
        </p>

        <p className="text-gray-400 text-sm max-w-xl mx-auto mb-8">
          The Witcher · Forgotten Realms · Cosmere · Pathfinder · Vampire · e muito mais...
        </p>

        <div className="flex flex-wrap gap-3 justify-center mb-10">
          <Link
            to="/register"
            className="bg-laranja text-white font-bold px-8 py-3 rounded-full hover:opacity-90 transition-all shadow-lg shadow-laranja/30 hover:scale-105 active:scale-95"
          >
            Cadastre-se e contribua →
          </Link>
        </div>

        {/* Contagem real */}
        <div className="inline-flex items-center gap-2 bg-blue-50 text-azul-escuro font-bold px-5 py-2 rounded-full border border-blue-100 text-sm shadow-sm">
          <BookOpen size={14} />
          {totalTermos > 0 ? (
            <>{totalTermos.toLocaleString('pt-BR')} termos cadastrados</>
          ) : (
            <>Carregando base de dados...</>
          )}
        </div>
      </section>

      {/* Proposta de valor — 3 cards */}
      <section className="grid md:grid-cols-3 gap-4 mb-10 px-4">
        <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center mb-4">
            <Globe size={20} className="text-azul-escuro" />
          </div>
          <h3 className="font-black text-azul-escuro text-base uppercase mb-2">Sistemas & Cenários</h3>
          <p className="text-gray-500 text-sm leading-relaxed">
            D&D · Pathfinder · Vampire · The Witcher · Cosmere · Thedas · e qualquer universo que a comunidade trouxer.
          </p>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="w-10 h-10 rounded-lg bg-orange-50 flex items-center justify-center mb-4">
            <BookOpen size={20} className="text-laranja" />
          </div>
          <h3 className="font-black text-azul-escuro text-base uppercase mb-2">Tradução com Rigor</h3>
          <p className="text-gray-500 text-sm leading-relaxed">
            Base oficial com selos de validação: Tradução Oficial, Rigor Artifício e Sugestão da Comunidade para total transparência.
          </p>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center mb-4">
            <Users size={20} className="text-green-600" />
          </div>
          <h3 className="font-black text-azul-escuro text-base uppercase mb-2">Comunidade Aberta</h3>
          <p className="text-gray-500 text-sm leading-relaxed">
            Qualquer jogador ou mestre pode se cadastrar, sugerir termos e contribuir para o glossário crescer junto com a cena nacional.
          </p>
        </div>
      </section>

      {/* Faixa "sem ads" */}
      <div className="bg-azul-escuro text-white rounded-xl p-5 mb-10 mx-4 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Heart size={20} className="text-laranja flex-shrink-0" />
          <p className="text-sm font-semibold">
            Gratuito para sempre · Sem anúncios · Sem coleta de dados pessoais
          </p>
        </div>
        <p className="text-gray-300 text-xs text-center md:text-right max-w-xs">
          Este é um presente da Artifício RPG para toda a comunidade brasileira de RPG. Compartilhe com seus grupos!
        </p>
      </div>
    </div>
  );
}
