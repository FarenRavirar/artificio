# 26-08-16_1 · `site-admin` — ativar lint e corrigir 6 erros de `react-hooks`

**Estado:** aberta · config criada e plugin instalado · **script ainda em `echo lint TODO`** · sem commit
**Branch sugerida:** `fix/site-admin-react-hooks` (partir de `dev` atualizado)
**Origem:** débito levantado durante a Fase 6 da spec 090 (PR #264), onde os no-ops de lint de `site-admin` e `links` foram descobertos. O `links` foi corrigido e fechado lá; este ficou por ser refactor de comportamento, não configuração.

---

## O que já está feito (veio na PR #264)

- `apps/site-admin/eslint.config.js` **criado**, no molde de `apps/site/eslint.config.js` — SPA React pura, sem `server/`/`db/`, então só o `vite.config.ts` recebe globals de Node.
- `eslint-plugin-react-hooks@^7.1.1` adicionado como devDependency, **com autorização nominal do mantenedor**. Mesma versão já usada em `downloads`, `mesas` e `glossario`; é devDependency, não entra em bundle nem em imagem Docker.
- `reactHooks.configs.flat.recommended` ligado na config.

## O que falta, e por que não foi feito junto

O script continua `"lint": "echo \"(site-admin) lint TODO\""`. **Trocar por `eslint .` antes de o app passar violaria a trava do `AGENTS.md`:** endurecer gate só depois do verde comprovado, nunca antes — senão transfere a falha mascarada para o próximo PR.

`npx eslint .` em 2026-08-16 devolveu **6 erros + 4 avisos** em 5 arquivos. Não são falso-positivo de configuração: é a primeira análise estática que este app recebe desde que existe, e ele é a SPA de autoria que **escreve post e página em produção**.

### Os achados, medidos

| Arquivo | Linha | Regra | Natureza |
|---|---|---|---|
| `src/editor/BlockEditor.tsx` | 41:3 | `react-hooks` | `Cannot access refs during render` |
| `src/editor/BlockEditor.tsx` | 27:38 | `exhaustive-deps` | dependência `load` faltando (aviso) |
| `src/pages/*.tsx` (4 arquivos) | 39/44/50/53/64 | `set-state-in-effect` | `setState` síncrono dentro de efeito → renders em cascata |
| idem | 39/44/50 | `exhaustive-deps` | dependência `load` faltando (aviso) |

O padrão repetido é `useEffect(() => { load("", ""); }, [])` com `load` chamando `setState` de forma síncrona. React recomenda extrair para evento ou derivar do render (https://react.dev/learn/you-might-not-need-an-effect).

## Aceite

1. Os 6 erros corrigidos **na raiz** — não com `eslint-disable`. Silenciar aqui é exatamente o mascaramento que o `AGENTS.md` proíbe; o único disable legítimo já existente (`BlockEditor.tsx:38`) documenta efeito de montagem única e passa a ser honrado agora que a regra existe na config.
2. Os 4 avisos de `exhaustive-deps` resolvidos ou justificados com comentário que diga **por que** a dependência fica de fora.
3. `npx eslint .` verde em `apps/site-admin`.
4. **Só então** trocar o script para `"lint": "eslint ."`.
5. Smoke manual do editor: criar, editar e salvar um post; confirmar que o conteúdo inicial carrega. As correções tocam efeitos de carregamento — teste automatizado não cobre o app hoje.

## Riscos

- **`BlockEditor` é o editor de conteúdo do blog.** Mexer em ordem de efeito ali pode quebrar o carregamento do HTML inicial (`tryParseHTMLToBlocks` → `replaceBlocks`) de forma que só aparece ao abrir um post existente, não ao criar um novo.
- O app **não tem suíte de teste**. Toda validação é manual, e é por isso que o smoke do item 5 não é opcional.

## Débito relacionado, fechado na PR #264

`apps/links` — mesma origem (`echo lint TODO`, sem `eslint.config`). Resolvido lá: config criada e um import morto removido (`configure` em `server/lib/cloudinary.ts`). Script já é `eslint .` e passa limpo.
