# Guia de Deploy - GLEPS CRM

Este guia explica como fazer o deploy do sistema GLEPS CRM em um servidor VPS.

## Índice

1. [Requisitos](#requisitos)
2. [Deploy Local (Desenvolvimento)](#deploy-local-desenvolvimento)
3. [Deploy em VPS com Docker](#deploy-em-vps-com-docker)
4. [Deploy Manual (Sem Docker)](#deploy-manual-sem-docker)
5. [Configurações de Produção](#configurações-de-produção)
6. [Manutenção](#manutenção)

---

## Requisitos

### Para desenvolvimento local:
- Node.js 20+
- PostgreSQL 16+ (ou Docker)
- npm ou bun

### Para deploy em VPS:
- Ubuntu 22.04+ ou Debian 12+
- Docker e Docker Compose
- Mínimo 2GB RAM
- 20GB de disco
- Domínio configurado (opcional, mas recomendado)

---

## Deploy Local (Desenvolvimento)

### 1. Iniciar o banco de dados

```bash
# Usando Docker (recomendado)
docker run -d \
  --name gleps_postgres \
  -e POSTGRES_USER=gleps \
  -e POSTGRES_PASSWORD=gleps_secret \
  -e POSTGRES_DB=gleps_crm \
  -p 5432:5432 \
  postgres:16-alpine
```

### 2. Configurar o backend

```bash
# Entrar na pasta do backend
cd backend

# Instalar dependências
npm install

# Gerar cliente Prisma
npm run db:generate

# Executar migrations
npm run db:migrate

# Popular banco com dados de teste
npm run db:seed

# Iniciar servidor de desenvolvimento
npm run dev
```

### 3. Configurar o frontend

```bash
# Na raiz do projeto
npm install

# Iniciar servidor de desenvolvimento
npm run dev
```

### 4. Acessar o sistema

- **Frontend:** http://localhost:8080
- **Backend API:** http://localhost:3000/api

### Credenciais de Teste

| Email | Senha | Role |
|-------|-------|------|
| superadmin@sistema.com | Admin@123 | Super Admin |
| carlos@clinicavidaplena.com | Admin@123 | Admin |
| ana@clinicavidaplena.com | Agent@123 | Agent |
| pedro@clinicavidaplena.com | Agent@123 | Agent |

---

## Deploy em VPS com Docker

### 1. Preparar o servidor

```bash
# Atualizar sistema
sudo apt update && sudo apt upgrade -y

# Instalar Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Instalar Docker Compose
sudo apt install docker-compose-plugin -y

# Adicionar usuário ao grupo docker
sudo usermod -aG docker $USER
newgrp docker
```

### 2. Clonar o repositório

```bash
cd /opt
git clone <seu-repositorio> gleps-crm
cd gleps-crm
```

### 3. Configurar variáveis de ambiente

```bash
# Criar arquivo de ambiente para produção
cat > .env.production << 'EOF'
# URLs
FRONTEND_URL=https://seu-dominio.com
API_URL=https://api.seu-dominio.com

# JWT (IMPORTANTE: Gere chaves seguras!)
JWT_SECRET=$(openssl rand -base64 48)
REFRESH_TOKEN_SECRET=$(openssl rand -base64 48)

# Google Calendar (opcional)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=https://api.seu-dominio.com/api/calendar/google/callback
EOF
```

### 4. Executar deploy

```bash
# Build e iniciar containers
docker compose -f docker-compose.yml --env-file .env.production up -d --build

# Verificar status
docker compose ps

# Ver logs
docker compose logs -f

# Executar migrations
docker compose exec backend npx prisma migrate deploy

# Popular banco com dados iniciais
docker compose exec backend npm run db:seed
```

### 5. Configurar Nginx (Proxy Reverso)

```bash
# Instalar Nginx
sudo apt install nginx -y

# Criar configuração
sudo nano /etc/nginx/sites-available/gleps-crm
```

```nginx
server {
    listen 80;
    server_name seu-dominio.com api.seu-dominio.com;

    location / {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}

server {
    listen 80;
    server_name api.seu-dominio.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
# Ativar site
sudo ln -s /etc/nginx/sites-available/gleps-crm /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 6. Configurar SSL (Let's Encrypt)

```bash
# Instalar Certbot
sudo apt install certbot python3-certbot-nginx -y

# Obter certificados
sudo certbot --nginx -d seu-dominio.com -d api.seu-dominio.com

# Renovação automática (já configurado pelo certbot)
sudo certbot renew --dry-run
```

---

## Deploy Manual (Sem Docker)

### 1. Instalar dependências do sistema

```bash
# Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# PostgreSQL 16
sudo sh -c 'echo "deb https://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'
wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | sudo apt-key add -
sudo apt update
sudo apt install postgresql-16 -y
```

### 2. Configurar PostgreSQL

```bash
# Acessar PostgreSQL
sudo -u postgres psql

# Criar banco e usuário
CREATE USER gleps WITH PASSWORD 'senha_segura';
CREATE DATABASE gleps_crm OWNER gleps;
GRANT ALL PRIVILEGES ON DATABASE gleps_crm TO gleps;
\q
```

### 3. Configurar Backend

```bash
cd /opt/gleps-crm/backend

# Instalar dependências
npm ci --production

# Configurar ambiente
cp .env.example .env
nano .env  # Editar com suas configurações

# Gerar Prisma client
npx prisma generate

# Executar migrations
npx prisma migrate deploy

# Seed inicial
npm run db:seed

# Build
npm run build
```

### 4. Configurar PM2 (Process Manager)

```bash
# Instalar PM2
sudo npm install -g pm2

# Iniciar aplicação
cd /opt/gleps-crm/backend
pm2 start dist/server.js --name gleps-api

# Salvar configuração
pm2 save

# Iniciar no boot
pm2 startup
```

### 5. Build do Frontend

```bash
cd /opt/gleps-crm

# Instalar dependências
npm ci

# Build para produção
npm run build

# Servir com Nginx (copiar arquivos)
sudo cp -r dist/* /var/www/html/
```

---

## Configurações de Produção

### Variáveis de Ambiente Críticas

| Variável | Descrição | Exemplo |
|----------|-----------|---------|
| `JWT_SECRET` | Chave secreta JWT (min 32 caracteres) | `openssl rand -base64 48` |
| `REFRESH_TOKEN_SECRET` | Chave para refresh tokens | `openssl rand -base64 48` |
| `DATABASE_URL` | URL do PostgreSQL | `postgresql://user:pass@host:5432/db` |
| `FRONTEND_URL` | URL do frontend | `https://app.exemplo.com` |

### Checklist de Segurança

- [ ] Alterar senhas padrão do banco de dados
- [ ] Gerar novas chaves JWT para produção
- [ ] Configurar SSL/HTTPS
- [ ] Configurar firewall (UFW)
- [ ] Configurar backup automático do banco
- [ ] Configurar rate limiting
- [ ] Remover dados de teste antes do go-live

### Firewall Básico

```bash
# Configurar UFW
sudo ufw allow ssh
sudo ufw allow http
sudo ufw allow https
sudo ufw enable
```

---

## Manutenção

### Backup do Banco de Dados

```bash
# Backup manual
docker compose exec postgres pg_dump -U gleps gleps_crm > backup_$(date +%Y%m%d).sql

# Restaurar backup
docker compose exec -T postgres psql -U gleps gleps_crm < backup.sql
```

### Atualizar Sistema

```bash
# Atualizar código
git pull origin main

# Rebuild containers
docker compose up -d --build

# Executar novas migrations
docker compose exec backend npx prisma migrate deploy
```

### Logs e Monitoramento

```bash
# Ver logs do backend
docker compose logs -f backend

# Ver logs do banco
docker compose logs -f postgres

# Status dos containers
docker compose ps
```

### Comandos Úteis

```bash
# Reiniciar serviços
docker compose restart

# Parar serviços
docker compose down

# Limpar tudo (CUIDADO: apaga dados!)
docker compose down -v

# Acessar shell do container
docker compose exec backend sh

# Acessar PostgreSQL
docker compose exec postgres psql -U gleps -d gleps_crm
```

---

## Suporte

Para questões ou problemas:
1. Verifique os logs: `docker compose logs -f`
2. Verifique status: `docker compose ps`
3. Consulte a documentação em `/docs/BACKEND_SPEC.md`

---

**Versão:** 1.0.0
**Última atualização:** 2026-01-26
