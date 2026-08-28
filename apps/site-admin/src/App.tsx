import { NavLink, Route, Routes } from "react-router-dom";
import { ConfirmProvider, Header } from "@artificio/ui";
import { PostsList } from "./pages/PostsList";
import { PostEditor } from "./pages/PostEditor";
import { PagesList } from "./pages/PagesList";
import { PageEditor } from "./pages/PageEditor";
import { MediaPage } from "./pages/MediaPage";
import { FeedbackPage } from "./pages/FeedbackPage";
import { CatalogSystemsPage } from "./pages/CatalogSystemsPage";

export function App() {
  return (
    <ConfirmProvider>
    {/* Header do portal no admin: dá acesso ao nav cross-subdomínio e ao menu de conta,
        que a sidebar própria não oferece — de dentro do admin não havia como ver quem
        está logado nem pular para outro projeto sem editar a URL na mão.
        `sticky={false}` de propósito: o admin é ferramenta de trabalho com tabelas longas,
        e um header fixo comeria altura útil em toda rolagem. A sidebar continua sendo a
        navegação primária daqui. */}
    <Header sticky={false} />
    <div className="admin-shell">
      <aside className="admin-side">
        <h1>Artifício <b>RPG</b><br />Administração</h1>
        <nav>
          <NavLink to="/" end>Posts</NavLink>
          <NavLink to="/posts/new">+ Novo post</NavLink>
          <NavLink to="/pages">Páginas</NavLink>
          <NavLink to="/pages/new">+ Nova página</NavLink>
          <NavLink to="/media">Mídia</NavLink>
          <NavLink to="/catalogo-sistemas">Sistemas</NavLink>
          <NavLink to="/feedback">Feedback</NavLink>
          <a href="/" target="_blank" rel="noreferrer">Ver site ↗</a>
        </nav>
      </aside>
      <main className="admin-main">
        <Routes>
          <Route path="/" element={<PostsList />} />
          <Route path="/posts/new" element={<PostEditor />} />
          <Route path="/posts/:id" element={<PostEditor />} />
          <Route path="/pages" element={<PagesList />} />
          <Route path="/pages/new" element={<PageEditor />} />
          <Route path="/pages/:id" element={<PageEditor />} />
          <Route path="/media" element={<MediaPage />} />
          <Route path="/catalogo-sistemas" element={<CatalogSystemsPage />} />
          <Route path="/feedback" element={<FeedbackPage />} />
        </Routes>
      </main>
    </div>
    </ConfirmProvider>
  );
}
