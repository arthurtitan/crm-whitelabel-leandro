
# Auditoria de Veracidade: Dashboard vs Chatwoot

## O que foi analisado

Cruzei 4 fontes de dados:
1. Resposta real da API `fetch-chatwoot-metrics` (network requests capturados)
2. Logs internos da Edge Function (timestamps de execução)
3. Tabela `contacts` do banco de dados
4. Tabela `resolution_logs` do banco de dados

---

## Periodo analisado: Ultimos 7 dias (13/02 - 20/02/2026)

### Metricas exibidas no Dashboard vs realidade

| Metrica | Dashboard mostra | Realidade / Chatwoot | Status |
|---|---|---|---|
| Total de Leads | 4 | 4 (contacts criados no periodo) | Correto |
| Conversas Ativas | 3 | 3 conversas abertas no periodo | A verificar |
| Conversas Resolvidas | 1 | 1 (resolucao dentro do periodo) | Correto |
| Atendimentos IA | 0 | 0 (nenhum ai_responded=true) | Correto |
| Atendimentos Humano | 1 | 1 (Conv #32 - Medeiros) | Correto |
| Sem Assignee | 19 | 19 conversas abertas sem responsavel | PROBLEMA |
| Pico por Hora | Tudo zero | Deveria ter picos em fev/08 | PROBLEMA |
| Backlog Humano | 0 | 1 (Conv #32 - Medeiros aberta) | PROBLEMA |

---

## Inconsistencias identificadas

### INCONSISTENCIA 1 - Atendimento "total: 20" ignora o filtro de data

O campo `atendimento.total = 20` representa **TODAS** as conversas abertas no Chatwoot hoje, independente do periodo de datas selecionado. Isso e intencional pela arquitetura atual ("tempo real"), mas gera confusao no usuario porque o filtro de datas nao afeta esse numero.

- Selecionando 7 dias: exibe 20 conversas ativas (todas as abertas do Chatwoot)
- Selecionando 30 dias: ainda exibe 20 conversas ativas (o mesmo conjunto)
- O usuario espera ver apenas conversas ativas **criadas no periodo**

### INCONSISTENCIA 2 - Pico de Atendimento zerado mesmo com dados no periodo

As 21 conversas foram criadas em **08/02/2026 as 02:47 UTC** (meia-noite e meia no horario de Brasilia, ou seja, ~23:47 do dia 07/02 em UTC-3). O grafico filtra apenas horarios entre 07h e 21h. Logo:

- Hora de criacao UTC = 2h da manha
- O grafico mostra apenas 07h-21h
- Resultado: hora 2 nunca aparece → gráfico zerado

Mesmo selecionando 30 dias (que inclui 08/02), o pico nao aparece porque **o horario UTC (02:47) cai fora da janela comercial exibida (07-21h)**.

**Raiz do problema**: O grafico usa hora UTC do Chatwoot, mas o usuario opera no fuso de Brasilia (UTC-3). As conversas foram criadas as 23:47 horario local, mas aparecem como 02:47 UTC — hora invisivel no grafico.

### INCONSISTENCIA 3 - Backlog Humano: 0 quando deveria ser 1

O backlog mostra 0, mas a Conv #32 (Arthur Henrique / Medeiros como assignee) esta **aberta com agente humano atribuido**. O problema e que o backlog usa `finalConversations` (filtrado por data), enquanto a propria arquitetura diz que o backlog deveria olhar para o tempo real (igual ao atendimento).

Evidencia nos logs:
```
[Atendimento] Conv #32 | handler=human | assignee=Medeiros
```
A conversa existe e tem assignee humano, mas o backlog calcula sobre `finalConversations` (filtrado por data) em vez de `filteredLiveConversations` (todas as abertas agora).

### INCONSISTENCIA 4 - resolution_logs com duplicatas na Conv #21

O banco tem 15 registros de resolucao para **apenas 2 conversas distintas**:
- Conv #21: 13 registros (muitas re-aberturas/re-fechamentos em 12/02)
- Conv #26: 1 registro (human)
- Conv #31: 1 registro (human)

A Edge Function deduplica corretamente e exibe apenas os unicos, mas os dados brutos do banco estao poluidos com testes do n8n.

---

## O que esta correto

- Total de Leads: correto — conta contatos no banco, nao conversas
- Agente Medeiros aparece com 1 atendimento assumido e 1 resolvido: correto
- Resolucao IA/Humano para 30 dias (60%/40%): correto contra os resolution_logs

---

## Correccoes propostas

### Correcao 1: Fuso horario no grafico de pico (ALTA PRIORIDADE)

Converter o timestamp UTC do Chatwoot para o fuso local do usuario antes de calcular a hora. Ou aceitar um parametro `timezone` do frontend (ex: `America/Sao_Paulo`, UTC-3) e aplicar o offset antes de incrementar `hourlyCount[hour]`.

**Arquivo**: `supabase/functions/fetch-chatwoot-metrics/index.ts` — linha 467

```text
ANTES:
  const hour = createdAt.getHours(); // hora UTC

DEPOIS:
  // Converte para horario de Brasilia (UTC-3)
  const hourLocal = (createdAt.getUTCHours() - 3 + 24) % 24;
  hourlyCount[hourLocal]++;
```

### Correcao 2: Backlog deve usar conversas ao vivo, nao filtradas por data

O backlog mede fila **atual**, portanto deve ser calculado sobre `filteredLiveConversations` (ja filtrado por inbox, mas nao por data), igual ao bloco de atendimento.

**Arquivo**: `supabase/functions/fetch-chatwoot-metrics/index.ts` — bloco de backlog (linha 471-489)

Mover o calculo de backlog para dentro do loop `filteredLiveConversations` (Processo 1), em vez do loop `finalConversations` (Processo 2).

### Correcao 3: "Conversas Ativas" deve ser separada claramente de "Total Atendimento"

O campo `conversasAtivas` hoje e calculado como `openCount` do historico filtrado por data, enquanto `atendimento.total` e o numero real de abertas agora. O dashboard mistura os dois conceitos no mesmo card. Proposta: exibir `atendimento.total` como "Em Atendimento Agora" e `conversasAtivas` como "Abertas no Periodo".

---

## Resumo das acoes

1. Corrigir fuso horario no grafico de pico: conversas criadas as 23h47 local devem aparecer na hora 23h, nao na hora 2h UTC
2. Mover calculo do backlog para o loop de conversas ao vivo (garantindo que Conv #32 apareca)
3. Comunicar ao usuario que "Atendimento Total" e sempre tempo real (nao respeita filtro de data) — isso e comportamento correto da arquitetura, mas precisa de rotulo mais claro no dashboard
