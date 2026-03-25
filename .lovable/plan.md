

## Integrar Logo SVG MyChooice e Ajustar Cor da Marca

### Descoberta
O SVG contém 3 variantes do logo:
- **Preto** (topo): texto e icone em `#000` — para fundos claros
- **Vermelho** (meio): texto e icone em `#ee3924` — versão colorida
- **Branco** (base): texto e icone em `#fff` sobre fundo preto — para sidebar escura

A cor oficial da marca extraida do SVG e `#ee3924` (vermelho-alaranjado), diferente do `#F97316` (laranja) que aplicamos antes. Vou corrigir.

### Alterações

**1. Copiar SVG para o projeto**
- `user-uploads://Logo-mychooice.svg` → `src/assets/mychooice-logo.svg`
- Tambem copiar para `public/favicon.svg`

**2. Criar versão otimizada para sidebar (branca)**
- Criar `src/assets/mychooice-logo-white.svg` — extrair apenas o grupo branco (linhas 57-69) com viewBox ajustado

**3. Atualizar cor primary em `src/index.css`**
- `--primary`: de `24 94% 53%` (#F97316) para `8 85% 54%` (#EE3924)
- `--primary-hover`: ajustar para tom mais escuro de #EE3924
- `--accent`: ajustar para tom mais claro
- `--ring`, `--info`, `--chart-1`, sidebar-primary, sidebar-ring: todos para a nova cor
- Atualizar `logoGlow` keyframes para usar #EE3924

**4. Atualizar imports nos componentes**
- `LoginPage.tsx`: import SVG em vez de PNG, usar versão vermelha/preta
- `AdminLayout.tsx`: import SVG versão branca para sidebar escura
- `SuperAdminLayout.tsx`: mesmo que AdminLayout

**5. Atualizar `index.html`**
- Favicon apontar para `/favicon.svg`

**6. Gradient do login**
- `from-primary to-orange-400` → `from-primary to-red-400` para combinar com #EE3924

### Detalhes Tecnicos
- A cor `#EE3924` em HSL e aproximadamente `hsl(8, 85%, 54%)`
- Hover: `#D42F1C` → `hsl(7, 79%, 47%)`
- Soft: `#FEF2F2` (vermelho muito claro)
- O SVG completo tem viewBox `0 0 595.28 841.89` (artboard do Illustrator) — precisa de viewBox ajustado para cada uso

