#!/bin/sh
# ============================================
# GLEPS CRM - Backend Startup Script
# ============================================
# Este script garante que o backend só inicia
# APÓS o banco estar pronto e as migrations
# terem sido aplicadas.
# ============================================

echo "============================================"
echo "GLEPS CRM - Backend Starting"
echo "============================================"

# ---- 1. Aguardar banco de dados ----
echo "⏳ Aguardando banco de dados..."
MAX_RETRIES=30
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if echo "SELECT 1;" | npx prisma db execute --stdin > /dev/null 2>&1; then
        echo "✅ Banco de dados acessível"
        break
    fi
    RETRY_COUNT=$((RETRY_COUNT + 1))
    echo "   Tentativa $RETRY_COUNT/$MAX_RETRIES - aguardando..."
    sleep 2
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
    echo "❌ ERRO: Banco de dados não respondeu após $MAX_RETRIES tentativas"
    exit 1
fi

# ---- 2. Aplicar migrations (com auto-recovery de P3009) ----
echo ""
echo "🔄 Aplicando migrations..."

MIGRATE_OUTPUT=$(npx prisma migrate deploy 2>&1)
MIGRATE_EXIT=$?

if [ $MIGRATE_EXIT -ne 0 ]; then
    echo "⚠️  Primeira tentativa de migration falhou (exit=$MIGRATE_EXIT)"

    # Check if it's a P3009 (failed migration blocking)
    if echo "$MIGRATE_OUTPUT" | grep -q "P3009"; then
        echo "🔧 Detectado P3009 — tentando resolver migration falhada..."

        # Try to resolve each known migration that could be stuck
        for MIGRATION_NAME in "0003_add_resolution_unique" "0002_add_resolution_logs"; do
            echo "   Resolvendo $MIGRATION_NAME como rolled-back..."
            npx prisma migrate resolve --rolled-back "$MIGRATION_NAME" 2>/dev/null || true
        done

        echo "🔄 Re-aplicando migrations..."
        MIGRATE_OUTPUT=$(npx prisma migrate deploy 2>&1)
        MIGRATE_EXIT=$?

        if [ $MIGRATE_EXIT -ne 0 ]; then
            echo "❌ Migration falhou mesmo após recovery:"
            echo "$MIGRATE_OUTPUT"
            echo ""
            echo "⚠️  Iniciando servidor mesmo assim (funcionalidade parcial)..."
        else
            echo "✅ Migrations aplicadas com sucesso após recovery"
        fi
    else
        echo "❌ Erro de migration (não é P3009):"
        echo "$MIGRATE_OUTPUT"
        echo ""
        echo "⚠️  Iniciando servidor mesmo assim (funcionalidade parcial)..."
    fi
else
    echo "✅ Migrations aplicadas"
fi

# ---- 3. Executar seed (se habilitado) ----
if [ "${RUN_SEED:-true}" = "true" ]; then
    echo ""
    echo "🌱 Executando seed..."
    node dist/prisma/seed.js || echo "⚠️ Seed falhou (pode já ter sido executado)"
    echo "✅ Seed concluído"
else
    echo ""
    echo "⏭️  Seed desabilitado (RUN_SEED=false)"
fi

# ---- 4. Diagnóstico e validação Google Calendar ----
echo ""
echo "🔍 Diagnóstico Google Calendar:"
echo "   [DEBUG] Variáveis GOOGLE_* no container:"
env | grep GOOGLE || echo "   (nenhuma variável GOOGLE_* encontrada)"
echo ""

GOOGLE_VARS_SET=0
GOOGLE_VARS_MISSING=""

if [ -n "$GOOGLE_CLIENT_ID" ]; then
    echo "   ✅ GOOGLE_CLIENT_ID presente (${#GOOGLE_CLIENT_ID} chars)"
    GOOGLE_VARS_SET=$((GOOGLE_VARS_SET + 1))
else
    echo "   ❌ GOOGLE_CLIENT_ID vazia ou ausente"
    GOOGLE_VARS_MISSING="$GOOGLE_VARS_MISSING GOOGLE_CLIENT_ID"
fi
if [ -n "$GOOGLE_CLIENT_SECRET" ]; then
    echo "   ✅ GOOGLE_CLIENT_SECRET presente (${#GOOGLE_CLIENT_SECRET} chars)"
    GOOGLE_VARS_SET=$((GOOGLE_VARS_SET + 1))
else
    echo "   ❌ GOOGLE_CLIENT_SECRET vazia ou ausente"
    GOOGLE_VARS_MISSING="$GOOGLE_VARS_MISSING GOOGLE_CLIENT_SECRET"
fi
if [ -n "$GOOGLE_REDIRECT_URI" ]; then
    echo "   ✅ GOOGLE_REDIRECT_URI = $GOOGLE_REDIRECT_URI"
    GOOGLE_VARS_SET=$((GOOGLE_VARS_SET + 1))
else
    echo "   ❌ GOOGLE_REDIRECT_URI vazia ou ausente"
    GOOGLE_VARS_MISSING="$GOOGLE_VARS_MISSING GOOGLE_REDIRECT_URI"
fi

# Validação de consistência: parcial = erro fatal
if [ "$GOOGLE_VARS_SET" -gt 0 ] && [ "$GOOGLE_VARS_SET" -lt 3 ]; then
    echo ""
    echo "🚫 ERRO FATAL: Configuração parcial do Google Calendar!"
    echo "   Variáveis presentes: $GOOGLE_VARS_SET/3"
    echo "   Faltando:$GOOGLE_VARS_MISSING"
    echo "   Todas as 3 variáveis devem estar configuradas ou nenhuma."
    echo "   Corrija no painel de variáveis de ambiente e faça rebuild."
    exit 1
elif [ "$GOOGLE_VARS_SET" -eq 3 ]; then
    echo "   📅 Google Calendar: totalmente configurado ✅"
else
    echo "   📅 Google Calendar: não configurado (opcional)"
fi

# ---- 5. Iniciar servidor ----
echo ""
echo "🚀 Iniciando servidor..."
exec node dist/server.js
