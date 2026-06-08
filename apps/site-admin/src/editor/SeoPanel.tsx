// Painel de SEO & Open Graph estilo Yoast: snippet do Google + contadores com feedback +
// preview social (OG/Twitter). Reusado por PostEditor e PageEditor (spec 011 T17/R27/R28).
import { useState } from "react";

export interface SeoFields {
  seo_title: string | null;
  seo_description: string | null;
  canonical: string | null;
  og_title: string | null;
  og_description: string | null;
  og_image: string | null;
  twitter_card?: string;
  noindex: boolean;
}

interface Props {
  value: SeoFields;
  onChange: (k: keyof SeoFields, v: string | boolean | null) => void;
  url: string;                  // URL pública final
  fallbackTitle: string;        // título do conteúdo (fallback do SEO/OG title)
  fallbackDescription: string;  // excerpt (fallback da meta/OG description)
  fallbackImage?: string | null; // imagem destacada (fallback do OG image)
  showTwitter?: boolean;        // pages não têm twitter_card
  onPickOgImage?: () => void;   // abre seletor de mídia p/ OG image
}

// Faixas ideais (chars). Verde = ideal, laranja = curto/quase, vermelho = longo demais.
const meter = (len: number, min: number, max: number): { cls: string; hint: string } => {
  if (len === 0) return { cls: "muted", hint: "usando o padrão" };
  if (len > max) return { cls: "bad", hint: "longo — pode ser cortado" };
  if (len < min) return { cls: "warn-t", hint: "curto" };
  return { cls: "good", hint: "bom" };
};

function Counter({ len, min, max }: { len: number; min: number; max: number }) {
  const m = meter(len, min, max);
  const pct = Math.min(100, (len / max) * 100);
  return (
    <div className="counter">
      <div className="counter-bar"><span className={`counter-fill ${m.cls}`} style={{ width: `${pct}%` }} /></div>
      <span className={`counter-num ${m.cls}`}>{len}/{max} · {m.hint}</span>
    </div>
  );
}

export function SeoPanel({ value, onChange, url, fallbackTitle, fallbackDescription, fallbackImage, showTwitter, onPickOgImage }: Props) {
  const [tab, setTab] = useState<"seo" | "social" | "adv">("seo");

  const effTitle = value.seo_title || fallbackTitle || "Título do conteúdo";
  const effDesc = value.seo_description || fallbackDescription || "Descrição aparece aqui quando você escrever um resumo ou meta description.";
  const ogTitle = value.og_title || value.seo_title || fallbackTitle || "Título";
  const ogDesc = value.og_description || value.seo_description || fallbackDescription || "Descrição do compartilhamento.";
  const ogImg = value.og_image || fallbackImage || "";
  let host = "artificiorpg.com";
  try { host = new URL(url).host; } catch { /* url relativa */ }

  return (
    <div className="card seo-card">
      <h3>SEO & Open Graph</h3>
      <div className="seo-tabs">
        <button type="button" className={tab === "seo" ? "on" : ""} onClick={() => setTab("seo")}>Busca</button>
        <button type="button" className={tab === "social" ? "on" : ""} onClick={() => setTab("social")}>Social</button>
        <button type="button" className={tab === "adv" ? "on" : ""} onClick={() => setTab("adv")}>Avançado</button>
      </div>

      {tab === "seo" && (
        <>
          {/* Preview do snippet do Google */}
          <div className="snippet">
            <div className="snippet-url">{url || `https://${host}/…`}</div>
            <div className="snippet-title">{effTitle}</div>
            <div className="snippet-desc">{effDesc}</div>
          </div>

          <label>Título SEO <span className="muted">(vazio = título do post)</span></label>
          <input type="text" value={value.seo_title ?? ""} placeholder={fallbackTitle || "Título"}
            onChange={(e) => onChange("seo_title", e.target.value || null)} />
          <Counter len={(value.seo_title || fallbackTitle || "").length} min={30} max={60} />

          <label>Meta description <span className="muted">(vazio = resumo)</span></label>
          <textarea value={value.seo_description ?? ""} placeholder={fallbackDescription || "Descrição para os resultados de busca"}
            onChange={(e) => onChange("seo_description", e.target.value || null)} />
          <Counter len={(value.seo_description || fallbackDescription || "").length} min={120} max={156} />
        </>
      )}

      {tab === "social" && (
        <>
          {/* Preview do card social (OG) */}
          <div className="social-card">
            {ogImg
              ? <div className="social-img" style={{ backgroundImage: `url(${JSON.stringify(ogImg).slice(1, -1)})` }} />
              : <div className="social-img empty">sem imagem</div>}
            <div className="social-body">
              <div className="social-host">{host.toUpperCase()}</div>
              <div className="social-title">{ogTitle}</div>
              <div className="social-desc">{ogDesc}</div>
            </div>
          </div>

          <label>OG title <span className="muted">(vazio = título SEO/post)</span></label>
          <input type="text" value={value.og_title ?? ""} placeholder={effTitle}
            onChange={(e) => onChange("og_title", e.target.value || null)} />

          <label>OG description <span className="muted">(vazio = meta/resumo)</span></label>
          <textarea value={value.og_description ?? ""} placeholder={effDesc}
            onChange={(e) => onChange("og_description", e.target.value || null)} />

          <label>OG image (URL) <span className="muted">(vazio = imagem destacada)</span></label>
          <div className={onPickOgImage ? "slug-row" : ""}>
            <input type="url" value={value.og_image ?? ""} placeholder={fallbackImage || "https://…"}
              onChange={(e) => onChange("og_image", e.target.value || null)} />
            {onPickOgImage && <button className="btn" type="button" onClick={onPickOgImage}>Biblioteca</button>}
          </div>

          {showTwitter && (
            <>
              <label>Twitter card</label>
              <select value={value.twitter_card ?? "summary_large_image"} onChange={(e) => onChange("twitter_card", e.target.value)}>
                <option value="summary_large_image">summary_large_image (imagem grande)</option>
                <option value="summary">summary (imagem pequena)</option>
              </select>
            </>
          )}
        </>
      )}

      {tab === "adv" && (
        <>
          <label>Canonical (URL) <span className="muted">(vazio = a própria URL)</span></label>
          <input type="url" value={value.canonical ?? ""} placeholder={url || "https://…"}
            onChange={(e) => onChange("canonical", e.target.value || null)} />

          <label className="row" style={{ gap: 8, marginTop: 12 }}>
            <input type="checkbox" style={{ width: "auto" }} checked={value.noindex}
              onChange={(e) => onChange("noindex", e.target.checked)} /> noindex (não indexar)
          </label>
          {value.noindex
            ? <p className="warn">Emite a meta tag <code>noindex</code> no HTML. A remoção do sitemap/RSS ocorre quando o conteúdo sai de "publish".</p>
            : <p className="muted">Mecanismos de busca podem indexar esta página.</p>}
        </>
      )}
    </div>
  );
}
