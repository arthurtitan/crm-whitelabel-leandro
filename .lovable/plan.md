

# Insights Estrategicos - Implementacao Final (Sem Dependencia de Agendamento)

## O que foi excluido e por que

A metrica "Receita por Reuniao" foi removida do escopo. O agendamento e feito pela IA via MCP Server no n8n, sem acesso direto ao SQL. Nao ha como vincular `contact_id` aos eventos sem alterar o MCP Server, o que foge do escopo.

Metricas excluidas:
- Receita por Reuniao
- Show Rate (taxa de comparecimento)
- Taxa de Fechamento por Reuniao
- Tempo Lead -> Reuniao

---

## O que sera implementado (100% funcional com dados existentes)

### 1. Card "Gargalo Identificado" (novo componente)

Arquivo: `src/components/insights/BottleneckCard.tsx`

Logica automatica de diagnostico baseada nos KPIs ja calculados:

```text
Se totalLeads < 10 -> "Captacao" (vermelho)
   "Poucos leads no funil. Invista em canais de aquisicao."

Se taxaConversao < 15% -> "Fechamento" (vermelho)
   "Leads nao convertem. Revise argumentacao e follow-up."

Se conversao > 25% e ticketMedio < receitaPorLead * 0.8 -> "Mix de Produto" (amarelo)
   "Conversao boa mas valor baixo. Priorize produtos premium."

Senao -> "Escala" (verde)
   "Processo saudavel. Aumente volume para escalar receita."
```

Card destacado com icone contextual (AlertTriangle, TrendingUp, etc), cor de fundo e recomendacao acionavel.

### 2. Velocidade de Conversao (novo componente)

Arquivo: `src/components/insights/ConversionVelocity.tsx`

Usa dados ja calculados: `contacts.created_at` vs `sales.paid_at`.

- Distribuicao em faixas com barras visuais:
  - Mesmo dia (0 dias)
  - 1-3 dias
  - 4-7 dias
  - 8-30 dias
  - 30+ dias
- Ciclo medio em destaque (ja calculado em `marketingMetrics.cicloMedioVenda`)
- Insight automatico: "X% das vendas ocorrem em ate 3 dias"
- Grafico de barras horizontal usando Recharts

### 3. Ranking de Agentes com dados REAIS (correcao de bug)

Alteracao em: `src/pages/admin/AdminInsightsPage.tsx`

Problema atual: usa `mockUsers` e `mockConversations` (dados falsos).

Correcao:
- Remover imports de `mockUsers` e `mockConversations`
- Buscar `profiles` reais via query ao banco filtrado por `account_id` do usuario logado
- Ranking usa `paidSales` reais agrupados por `responsavel_id`
- Remover tab "Por Atendimentos" (depende de conversations mock) -- ou manter com dados do `resolution_logs` se houver dados
- Metricas por agente: vendas, receita, ticket medio, numero de agendamentos

### 4. Insights Automaticos Aprimorados

Novas regras adicionadas ao array `automaticInsights`:

- **Produto com ticket alto pouco vendido**: se existe produto com ticketMedio > media * 1.5 e unidades < media * 0.5, sugerir priorizacao
- **Agente destaque**: se um agente tem taxa de fechamento > 30% acima da media, sugerir replicar estrategia
- **Dependencia de metodo de pagamento**: se um metodo > 60% das vendas, alertar sobre risco
- **Queda semanal**: comparar vendas da semana atual vs anterior, alertar se queda > 20%
- **Velocidade como insight**: "X% das vendas fecham em ate 3 dias -- leads que nao fecham rapido tem apenas Y% de chance"

### 5. Ticket Medio por Metodo de Pagamento (aprimorado)

Ja existe parcialmente. Adicionar insight comparativo automatico:
- "Clientes via [metodo X] gastam Y% mais que via [metodo Z]"
- Ja parcialmente implementado em `paymentInsight`, sera mantido

### 6. Receita por Dia da Semana com taxa de conversao

Aprimorar `temporalData` para cruzar:
- Volume de vendas por dia da semana (ja existe)
- Numero de leads criados por dia da semana (novo)
- Taxa de conversao por dia = vendas do dia / leads do dia
- Identificar melhor dia estrategico (nao so por volume, mas por eficiencia)

---

## Estrutura da pagina apos alteracoes

A pagina mantem a estrutura de tabs existente, com os novos componentes integrados:

- **KPI Cards**: mantidos como estao (faturamento, ticket medio, taxa conversao, receita/lead)
- **Card Gargalo**: inserido logo abaixo dos KPIs, em destaque
- **Tab "Geral"**: Funil + Velocidade de Conversao + Insights Automaticos (expandidos)
- **Tab "Produtos"**: Tabela de produtos (mantida)
- **Tab "Temporal"**: Grafico temporal + dia da semana com taxa de conversao
- **Tab "Marketing"**: Metricas marketing + Metodos pagamento
- **Ranking de Agentes**: com dados reais, na secao existente

---

## Arquivos a criar/modificar

1. `src/components/insights/BottleneckCard.tsx` -- novo
2. `src/components/insights/ConversionVelocity.tsx` -- novo
3. `src/components/insights/index.ts` -- adicionar exports
4. `src/pages/admin/AdminInsightsPage.tsx` -- refatoracao principal (remover mocks, adicionar gargalo, velocidade, insights expandidos, ranking real)

### Dependencias
- Nenhuma nova dependencia (usa Recharts ja instalado, componentes UI existentes)
- Nenhuma migration necessaria
- Query de `profiles` via Supabase client ja disponivel

