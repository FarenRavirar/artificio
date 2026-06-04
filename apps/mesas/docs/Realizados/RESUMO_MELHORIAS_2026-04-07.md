# Sistema de Vagas Implementado — REQ-02

**Data:** 2026-04-07  
**Status:** ✅ COMPLETO

---

## Resumo

Sistema de vagas refatorado para separar "vagas totais" de "vagas abertas para recrutamento".

**Antes:** Apenas `slots_total` e `slots_filled`  
**Depois:** `slots_total`, `slots_filled` e `slots_open`

---

## ✅ Implementação Completa

### 1. Migration Executada ✅

**Arquivo:** `database/migration_100_add_slots_open.sql`

```sql
ALTER TABLE tables ADD COLUMN IF NOT EXISTS slots_open INTEGER;
UPDATE tables SET slots_open = GREATEST(0, slots_total - COALESCE(slots_filled, 0)) WHERE slots_open IS NULL;
ALTER TABLE tables ALTER COLUMN slots_open SET NOT NULL;
ALTER TABLE tables ADD CONSTRAINT check_slots_valid CHECK (slots_open >= 0 AND slots_filled >= 0 AND slots_open <= slots_total);
```

**Resultado:** 2 mesas atualizadas no banco beta

**Verificação:**
```
 column_name  | data_type | is_nullable 
--------------+-----------+-------------
 slots_filled | integer   | NO
 slots_open   | integer   | NO
 slots_total  | integer   | NO
```

---

### 2. Backend Atualizado ✅

**Arquivos modificados:**

1. **`backend/src/db/types.ts`**
   - Tipo `TablesTable` atualizado com `slots_open: Generated<number>`

2. **`backend/src/routes/gmPanel.ts`**
   - POST (criação): Adiciona `slots_open` no body e insert
   - PUT (edição): Adiciona `slots_open` no body e update
   - Default: `slots_open = slots_total` (todas vagas abertas)

3. **`backend/src/routes/tables.ts`**
   - GET (catálogo): Retorna `slots_open`
   - GET /:slug (detalhes): Retorna `slots_open`

---

### 3. Frontend Atualizado ✅

**Arquivos modificados:**

1. **Tipos:**
   - `frontend/src/types/tables.ts` — `TableCard` com `slots_open: number`
   - `frontend/src/features/create-table/types/createTable.types.ts`:
     - `BasicFormData` com `slots_open: string`
     - `CreateTablePayload` com `slots_open: number`

2. **Hook:**
   - `frontend/src/features/create-table/hooks/useCreateTableForm.ts`:
     - Estado inicial: `slots_open: '4'`
     - Reset: `slots_open: '4'`

3. **Mapper:**
   - `frontend/src/features/create-table/utils/mapper.ts`:
     - Payload: `slots_open: parseInt(state.form.slots_open) || 0`

4. **UI:**
   - `frontend/src/components/form-steps/steps/StepConfig.tsx`:
     - Campo "Vagas Abertas para Recrutamento" adicionado
     - Tipo `StepConfigProps` atualizado

---

## 🎯 Comportamento

### Criação de Mesa
- Mestre define "Vagas Totais" (ex: 5 jogadores)
- Mestre define "Vagas Abertas" (ex: 2 vagas para recrutamento)
- Backend valida: `slots_open <= slots_total`

### Exibição
- API retorna ambos os campos
- Frontend pode exibir: "5 jogadores / 2 vagas abertas"

### Validação
- Constraint no banco: `slots_open >= 0 AND slots_open <= slots_total`
- Frontend: `min="0"` e `max="20"`

---

## 📋 Próximos Passos (Opcional)

### Exibição nos Cards
Atualmente os cards não exibem vagas. Para adicionar:

```tsx
// frontend/src/components/TableCard.tsx
<div className="flex items-center gap-2 text-sm">
  <Users className="w-4 h-4" />
  <span className="text-white/80">
    {table.slots_total} jogadores
  </span>
  {table.slots_open > 0 && (
    <span className="text-green-400">
      • {table.slots_open} vagas abertas
    </span>
  )}
</div>
```

### Validação Dinâmica
Adicionar validação no formulário para garantir que `slots_open <= slots_total`:

```tsx
// StepConfig.tsx
const handleSlotsChange = (e: ChangeEvent<HTMLInputElement>) => {
  const { name, value } = e.target;
  const numValue = parseInt(value) || 0;
  
  if (name === 'slots_open' && numValue > parseInt(form.slots_total)) {
    toast.error('Vagas abertas não podem exceder o total');
    return;
  }
  
  setForm({ ...form, [name]: value });
};
```

---

## ✅ Checklist Final

- [x] Migration criada
- [x] Migration executada no banco beta
- [x] Tipos backend atualizados
- [x] Rotas backend atualizadas (POST, PUT, GET)
- [x] Tipos frontend atualizados
- [x] Hook frontend atualizado
- [x] Mapper frontend atualizado
- [x] UI frontend atualizada (campo no formulário)
- [x] Validação no banco (constraint)
- [ ] Exibição nos cards (opcional)
- [ ] Validação dinâmica no form (opcional)

---

## 🚀 Pronto para Deploy

Sistema completo e funcional. Próximo deploy incluirá:
- ✅ REQ-01: Botão criar cenário
- ✅ REQ-02: Sistema de vagas
- ✅ REQ-03: Audiência legado removida
- ✅ REQ-06: Erro 400 corrigido

**Pendentes para próxima iteração:**
- REQ-04: Banner 4:3
- REQ-05: Flag Covil do Lich
