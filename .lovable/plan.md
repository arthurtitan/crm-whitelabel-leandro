

## Correcao definitiva do scroll do CreateLeadDialog

### Problema
A barra de scroll esta visivel e feia. O `max-h-[40dvh]` funciona para conter a area, mas o scrollbar nativo esta aparecendo de forma indesejada.

### Solucao

**Arquivo: `src/components/kanban/CreateLeadDialog.tsx`**

Adicionar classes CSS para ocultar a scrollbar mantendo o scroll funcional:
- Trocar `overflow-y-auto pr-1` por classes que escondem a scrollbar nativa
- Usar as classes utilitarias `scrollbar-hide` ou aplicar inline com `[&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]`
- Reduzir `max-h-[40dvh]` para `max-h-[50dvh]` para aproveitar melhor o espaco disponivel mantendo os botoes visiveis

A alteracao e de uma unica linha no `div` que envolve os campos do formulario:

```
// De:
<div className="space-y-4 max-h-[40dvh] overflow-y-auto pr-1">

// Para:
<div className="space-y-4 max-h-[50dvh] overflow-y-auto pr-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
```

Isso oculta a scrollbar em todos os navegadores (Chrome/Safari via webkit, Firefox via scrollbar-width, IE/Edge via ms-overflow-style) enquanto mantem o scroll por toque/trackpad totalmente funcional.

