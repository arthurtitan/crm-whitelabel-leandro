

## Correcao de Responsividade do Dialog "Adicionar Novo Lead"

### Problema raiz

O `DialogContent` base ja define `grid`, `gap-4`, `max-h-[90vh]` e `overflow-hidden`. O `CreateLeadDialog` tenta sobrescrever com `flex flex-col` e `max-h-[85dvh]`, mas:

1. O `tailwind-merge` pode nao resolver corretamente `max-h-[90vh]` vs `max-h-[85dvh]` (unidades diferentes)
2. O padding interno (`p-4 sm:p-6`) e o `gap-4` consomem espaco que nao e contabilizado no calculo do scroll

### Solucao

Em vez de depender do flex layout do dialog inteiro, aplicar uma altura maxima fixa diretamente no container dos campos do formulario. Isso garante que os campos rolem internamente enquanto o header e o footer (botoes) ficam sempre visiveis, independente do layout do DialogContent.

### Alteracoes

**Arquivo: `src/components/kanban/CreateLeadDialog.tsx`**

- Remover as classes de flex/overflow do `DialogContent` e do `form`, voltando a depender do layout grid padrao do dialog
- Aplicar `max-h-[40dvh] overflow-y-auto` diretamente no `div` que envolve os campos do formulario
- Isso cria uma area de scroll fixa para os campos, enquanto header e footer permanecem estaticos

Resultado: o header, a area scrollavel de campos, e os botoes de acao ficam sempre visiveis, sem depender de flex nesting complexo que conflita com o componente base.

