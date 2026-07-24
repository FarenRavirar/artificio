import { AppShell } from '../components/AppShell';

// T9.1 (spec 084) — pagina institucional publica que faltava (auditoria
// confirmou zero pagina de termos/uso/licenca antes desta spec). Cobre:
// D119 (so portugues), hub/redirecionamento (D107, external_link nunca hospeda
// copia), transparencia do scraper (materiais indexados automaticamente),
// diretrizes de moderacao humana (D100).
export function SobreEUsoPage() {
  return (
    <AppShell>
      <div className="mx-auto max-w-3xl px-4 py-12 text-[var(--fg)]">
        <h1 className="text-3xl font-bold">Sobre e uso do Artifício Downloads</h1>

        <section className="mt-8 space-y-3">
          <h2 className="text-xl font-semibold">Apenas materiais em português</h2>
          <p className="text-[var(--fg-muted)]">
            O Artifício Downloads indexa e cataloga apenas materiais de RPG em português. Isso vale
            para todo material publicado aqui, seja cadastrado manualmente por um usuário ou
            indexado automaticamente por nosso sistema — nunca abrimos exceção para conteúdo em
            outro idioma.
          </p>
        </section>

        <section className="mt-8 space-y-3">
          <h2 className="text-xl font-semibold">Gratuito ou pague-quanto-quiser</h2>
          <p className="text-[var(--fg-muted)]">
            Todo material listado aqui é gratuito ou PWYW (pague o quanto quiser, incluindo a opção
            de pagar zero). Nunca listamos material pago sem opção gratuita.
          </p>
        </section>

        <section className="mt-8 space-y-3">
          <h2 className="text-xl font-semibold">Somos um hub de descoberta, não hospedamos arquivos</h2>
          <p className="text-[var(--fg-muted)]">
            O Artifício Downloads nunca hospeda cópia de arquivo de terceiros. Todo material aponta
            para o link original da fonte (itch.io, site do autor, editora etc.) — clicar em
            &quot;baixar&quot; sempre redireciona para onde o material foi publicado originalmente.
          </p>
        </section>

        <section className="mt-8 space-y-3">
          <h2 className="text-xl font-semibold">Indexação automática (transparência)</h2>
          <p className="text-[var(--fg-muted)]">
            Parte do catálogo é populada automaticamente por um sistema de indexação que varre
            fontes públicas conhecidas (como itch.io e outros sites brasileiros de RPG) em busca de
            materiais gratuitos ou PWYW em português. Todo material indexado dessa forma:
          </p>
          <ul className="list-disc space-y-2 pl-6 text-[var(--fg-muted)]">
            <li>é confirmado como português antes de ser publicado, com verificação em duas camadas;</li>
            <li>é confirmado como gratuito/PWYW antes de ser publicado, nunca por suposição;</li>
            <li>aponta sempre para o link original — nunca uma cópia;</li>
            <li>é re-verificado periodicamente — se o preço mudar para pago na fonte original, o material é removido do catálogo automaticamente.</li>
          </ul>
        </section>

        <section className="mt-8 space-y-3">
          <h2 className="text-xl font-semibold">Materiais cadastrados por usuários</h2>
          <p className="text-[var(--fg-muted)]">
            Materiais enviados diretamente por usuários passam por moderação humana antes de
            aparecerem publicamente no catálogo. Nossa equipe de moderação verifica idioma,
            gratuidade e conformidade com nossas diretrizes antes da publicação.
          </p>
        </section>

        <section className="mt-8 space-y-3">
          <h2 className="text-xl font-semibold">Direitos autorais</h2>
          <p className="text-[var(--fg-muted)]">
            Respeitamos os direitos autorais dos criadores de conteúdo. Se você é autor de um
            material listado aqui e deseja que ele seja removido, ou identificou algum problema de
            direitos autorais, entre em contato através do canal de denúncia disponível na página do
            material.
          </p>
        </section>
      </div>
    </AppShell>
  );
}
