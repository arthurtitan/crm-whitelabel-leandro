

# Limpeza do Repositorio para Producao

## Objetivo
Remover apenas codigo morto (nunca importado), mantendo tudo que e necessario para o deploy em producao com PostgreSQL, Express/Prisma e Docker.

## O que sera REMOVIDO (confirmado sem nenhum import no projeto)

| Arquivo/Pasta | Motivo da remocao |
|---|---|
| `microservices/` (pasta inteira, ~50 arquivos) | Arquitetura alternativa nunca integrada ao frontend |
| `src/pages/Index.tsx` | Pagina placeholder, nao esta em nenhuma rota |
| `src/pages/NotFound.tsx` | Nunca importada em nenhum lugar |
| `src/services/chatwootMetricsApi.ts` | Nunca importada por nenhum arquivo |
| `src/test/example.test.ts` | Teste placeholder (`true === true`) |
| `docs/BACKEND_SPEC.md` | Documentacao de especificacao, nao afeta build |
| `docs/N8N_CHATWOOT_INTEGRATION.md` | Documentacao de integracao, nao afeta build |
| `DEPLOY.md` | Guia de deploy substituido pela configuracao EasyPanel |

## O que sera MANTIDO (essencial para producao)

| Arquivo/Pasta | Motivo |
|---|---|
| `backend/` (inteiro) | Express API + Prisma + controllers + services + migrations |
| `backend/prisma/schema.prisma` | Schema do PostgreSQL de producao |
| `backend/Dockerfile` | Build do container backend |
| `docker-compose.yml` | Orquestracao no EasyPanel (postgres + backend + frontend) |
| `Dockerfile.frontend` | Build do container frontend |
| `nginx.conf` | Proxy reverso do frontend para backend |
| `.env.production` | Template de variaveis de ambiente para producao |
| `backend/.env.example` | Referencia de configuracao do backend |
| `backend/scripts/migrate.sh` | Script de migracao do banco |
| `src/contexts/AuthContext.backend.tsx` | Autenticacao via JWT para modo backend |
| `src/services/*.backend.service.ts` | Services que conectam ao Express API |
| `src/config/backend.config.ts` | Flag `VITE_USE_BACKEND` |
| `src/data/mock*.ts` e `src/mocks/` | Fallback de dados usado por componentes ativos |
| `src/test/setup.ts` | Infraestrutura de testes (Vitest) |
| Todas as edge functions (`supabase/functions/`) | Funcionalidades ativas no Cloud |
| `README.md` | Documentacao do projeto |

## Detalhes Tecnicos

### Verificacao realizada
- Busca por `import.*from.*microservices` no `src/`: 0 resultados
- Busca por `import.*from.*NotFound`: 0 resultados
- Busca por `import.*from.*Index` (pagina): 0 resultados
- Busca por `import.*from.*chatwootMetricsApi`: 0 resultados
- `App.tsx` nao referencia `Index.tsx` nem `NotFound.tsx` em nenhuma rota

### Impacto
- Zero impacto no build ou deploy
- O `docker-compose.yml` nao referencia nada da pasta `microservices/`
- O frontend continua funcionando identicamente em ambos os modos (Cloud e Backend)

### Ordem de execucao
1. Deletar pasta `microservices/` inteira
2. Deletar arquivos individuais listados acima
3. Commit e push para o GitHub
4. Re-deploy no EasyPanel (automatico se conectado ao Git)

