

## Reestruturação da Identidade Visual: MyChooice GoodLeads

### Resumo
Substituir toda a identidade Gleps.AI por MyChooice GoodLeads com paleta laranja/preto. Aguardamos o logo SVG que o usuário vai enviar.

### Paleta de Cores (Laranja/Preto)
- **Primary**: `#F97316` (laranja vibrante) com hover `#EA580C`
- **Primary soft**: `#FFF7ED` (laranja claro)
- **Sidebar background**: `#0A0A0A` (preto profundo)
- **Sidebar accent**: `#1A1A1A`
- **Accent**: `#FB923C` (laranja secundario)
- Manter cores de status (success, warning, destructive) como estão

### Arquivos a Alterar

**1. Logo** (quando o SVG chegar)
- Copiar SVG para `src/assets/mychooice-logo.svg`
- Copiar para `public/favicon.svg` (ou gerar PNG para favicon)

**2. `index.html`** — Atualizar title, meta tags, favicon
- Title: "MyChooice GoodLeads"
- Description: "Plataforma de gestão de leads e CRM - MyChooice"
- Favicon: apontar para novo logo

**3. `src/index.css`** — Atualizar CSS variables
- `--primary`: de azul (`217 91% 60%`) para laranja (`24 94% 53%`)
- `--primary-hover`: laranja escuro
- `--primary-soft`: laranja muito claro
- `--ring`: laranja
- `--accent`: laranja
- Sidebar: trocar purple por preto puro (`--sidebar-background`, `--sidebar-accent`, etc.)
- `--chart-1`: laranja
- `.glass` e `.glass-strong`: gradients de preto em vez de purple
- `logoGlow`: keyframes com laranja em vez de azul/purple

**4. `src/pages/LoginPage.tsx`**
- Trocar `import glepsLogo` por novo logo
- Trocar "Painel Gleps" por "GoodLeads"
- Trocar "Powered by Gleps.AI" por "Powered by MyChooice"
- Gradient text: `from-primary to-orange-400` em vez de `to-purple-400`

**5. `src/layouts/AdminLayout.tsx`**
- Trocar import do logo
- Trocar alt texts de "Gleps.AI" para "MyChooice"
- Trocar "Painel Gleps" por "GoodLeads"

**6. `src/layouts/SuperAdminLayout.tsx`**
- Mesmas mudanças: logo, alt text, "Gleps Admin" → "GoodLeads Admin"

### Dependencia
Precisamos do arquivo SVG do logo antes de implementar. O usuário confirmou que vai enviar.

