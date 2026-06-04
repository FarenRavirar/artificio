# Git Hooks - Mesas RPG Artifício

## Pre-commit Hook

### O que faz

Este hook **bloqueia commits** quando:

1. **Há arquivos modificados não incluídos no commit**
   - Evita commits parciais acidentais
   - Garante que todas as mudanças relacionadas sejam commitadas juntas

2. **Há erros de tipo TypeScript** (quando arquivos `.ts` ou `.tsx` são modificados)
   - Valida tipos antes do commit
   - Previne erros de build no CI/CD

### Instalação

O hook já está instalado em `.git/hooks/pre-commit`.

Para reinstalar ou atualizar:

```bash
# Windows (PowerShell)
Copy-Item -Path "scripts\pre-commit" -Destination ".git\hooks\pre-commit" -Force

# Linux/Mac
cp scripts/pre-commit .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit
```

### Como usar

O hook roda automaticamente antes de cada commit. Se houver problemas, você verá:

```
❌ COMMIT BLOQUEADO: Há arquivos modificados não incluídos no commit:

  - frontend/src/components/FilterDrawer.tsx
  - frontend/src/pages/CatalogoPage.tsx

Escolha uma das opções:
  1. git add <arquivo>  - para adicionar arquivos específicos
  2. git add -u         - para adicionar todos os arquivos rastreados modificados
  3. git commit -a      - para commitar todos os arquivos modificados
```

### Bypass (use com cuidado)

Se precisar fazer commit mesmo com arquivos não staged:

```bash
git commit --no-verify -m "mensagem"
```

**⚠️ Use apenas quando tiver certeza do que está fazendo!**

### Exemplo de uso correto

```bash
# 1. Modificar arquivos
# 2. Verificar o que foi modificado
git status

# 3. Adicionar TODOS os arquivos relacionados
git add frontend/src/pages/CatalogoPage.tsx
git add frontend/src/components/FilterDrawer.tsx
git add frontend/src/components/ResultsHeader.tsx

# 4. Commit (hook valida automaticamente)
git commit -m "fix: corrige paginação"

# ✅ Se tudo estiver OK, commit é permitido
# ❌ Se faltar arquivo ou houver erro de tipo, commit é bloqueado
```

### Benefícios

- ✅ Previne commits incompletos
- ✅ Detecta erros de tipo antes do CI/CD
- ✅ Economiza tempo (evita builds falhados)
- ✅ Mantém histórico Git limpo

### Manutenção

O script fonte está em `scripts/pre-commit`. Para atualizar:

1. Edite `scripts/pre-commit`
2. Reinstale: `Copy-Item -Path "scripts\pre-commit" -Destination ".git\hooks\pre-commit" -Force`

---

**Nota:** Hooks do Git não são versionados (ficam em `.git/hooks/`). Por isso mantemos uma cópia em `scripts/` para compartilhar com a equipe.
