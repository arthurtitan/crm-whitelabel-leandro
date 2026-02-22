

## Correcao definitiva: Icons dos KPI Cards

### Problema raiz
A classe `.kpi-grid-6` forca 6 colunas a partir de 1280px, tornando cada card com apenas ~170px de largura. Titulos longos como "AGENDAMENTOS", "TEMPO MEDIO RESPOSTA" e "TAXA DE TRANSBORDO" nao cabem ao lado do icone nessa largura.

### Solucao

**Arquivo: `src/index.css`**

Alterar o breakpoint de 6 colunas de 1280px para 1536px (2xl). Em 1280px, manter 3 colunas (grid 3x2):

- `@media (min-width: 1280px)`: manter `repeat(3, minmax(0, 1fr))` (3 colunas)
- Adicionar `@media (min-width: 1536px)`: usar `repeat(6, minmax(0, 1fr))` (6 colunas)

Isso garante que os cards tenham largura suficiente (~350px em 1280px) para acomodar titulo + icone sem overflow.

### Detalhes tecnicos

Mudanca no `src/index.css`, linhas 605-609:

Antes:
```css
@media (min-width: 1280px) {
  .kpi-grid-6 {
    grid-template-columns: repeat(6, minmax(0, 1fr));
  }
}
```

Depois:
```css
@media (min-width: 1280px) {
  .kpi-grid-6 {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (min-width: 1536px) {
  .kpi-grid-6 {
    grid-template-columns: repeat(6, minmax(0, 1fr));
    gap: 1rem;
  }
}
```

Nenhuma outra mudanca necessaria. O KPICard.tsx ja tem `overflow-hidden`, `min-w-0` e `shrink-0` corretos.
