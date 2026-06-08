import { NavLink, Route, Routes } from "react-router-dom";
import { PostsList } from "./pages/PostsList";
import { PostEditor } from "./pages/PostEditor";
import { PagesList } from "./pages/PagesList";
import { PageEditor } from "./pages/PageEditor";
import { MediaPage } from "./pages/MediaPage";

export function App() {
  return (
    <div className="admin-shell">
      <aside className="admin-side">
        <h1>Artifício <b>RPG</b><br />Administração</h1>
        <nav>
          <NavLink to="/" end>Posts</NavLink>
          <NavLink to="/posts/new">+ Novo post</NavLink>
          <NavLink to="/pages">Páginas</NavLink>
          <NavLink to="/pages/new">+ Nova página</NavLink>
          <NavLink to="/media">Mídia</NavLink>
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
        </Routes>
      </main>
    </div>
  );
}
