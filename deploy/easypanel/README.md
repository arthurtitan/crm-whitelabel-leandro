# GLEPS CRM - Deploy no EasyPanel

## Pré-requisitos

- VPS com EasyPanel instalado
- Repositório Git acessível pelo EasyPanel
- Domínio configurado (DNS apontando para o IP da VPS)

---

## Passo a Passo

### 1. Criar o App no EasyPanel

1. Acesse o painel do EasyPanel
2. Clique em **"Create App"** → **"Docker Compose"**
3. No campo de configuração, cole o conteúdo de `deploy/easypanel/docker-compose.yml`
   - **Ou** configure o repositório Git e aponte para o path `deploy/easypanel/docker-compose.yml`

### 2. Configurar Variáveis de Ambiente

No painel do EasyPanel, vá em **Environment Variables** e configure todas as variáveis listadas em `.env.example`.

**⚠️ OBRIGATÓRIAS (o app não sobe sem elas):**

| Variável | Exemplo |
|----------|---------|
| `DB_USER` | `gleps` |
| `DB_PASSWORD` | `SenhaForte123!` |
| `DB_NAME` | `gleps_crm` |
| `FRONTEND_URL` | `https://360.seudominio.com.br` |
| `JWT_SECRET` | (gere com `openssl rand -base64 32`) |
| `REFRESH_TOKEN_SECRET` | (gere com `openssl rand -base64 32`) |

### 3. Mapear Domínio

1. No EasyPanel, vá no serviço **`frontend`**
2. Clique em **"Domains"**
3. Adicione seu domínio: `360.seudominio.com.br`
4. **Porta interna: `80`**
5. Ative HTTPS/SSL automático

> ⚠️ **IMPORTANTE**: O domínio deve apontar APENAS para o serviço `frontend`, porta `80`. O Nginx dentro do frontend faz o proxy para o backend automaticamente.

### 4. Deploy

Clique em **"Deploy"** ou **"Rebuild"** no EasyPanel.

---

## Checklist Pós-Deploy

Após o deploy, verifique na aba **Logs** do EasyPanel:

### Backend (verificar nos logs do serviço `backend`):
- [ ] `✅ Database connection established` (banco acessível)
- [ ] `✅ Migrations applied successfully` (schema ok)
- [ ] `🚀 Server running on port 3000` (API rodando)

### Frontend (verificar nos logs do serviço `frontend`):
- [ ] Nginx iniciou sem erros

### Teste funcional:
- [ ] Acessar `https://seudominio.com.br` → Tela de login aparece
- [ ] Acessar `https://seudominio.com.br/health` → Retorna "OK"
- [ ] Login com credenciais seed funciona
- [ ] Após login, dashboard carrega dados

---

## Credenciais Seed (primeiro acesso)

| Campo | Valor |
|-------|-------|
| Email | `admin@gleps.com` |
| Senha | `Admin@123` |

> ⚠️ **Troque a senha após o primeiro login!**

---

## Arquitetura de Rede

```
Internet → EasyPanel Proxy → frontend:80 (Nginx)
                                ├── / → Serve React SPA
                                ├── /api/* → proxy_pass → backend:3000
                                └── /health → 200 OK

backend:3000
  ├── /api/health → 200 OK
  ├── /api/auth/* → Autenticação
  └── /api/* → Demais rotas

postgres:5432
  └── Database gleps_crm
```

---

## Troubleshooting Rápido

Se algo falhar, consulte o arquivo `diagnostics.md` nesta mesma pasta.
