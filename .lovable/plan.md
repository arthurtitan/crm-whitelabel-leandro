

## Criar Vendas de Teste para Validar Cards de Melhor/Menor Dia

### Objetivo
Inserir 5 vendas adicionais no banco de dados em datas diferentes (espalhadas nos ultimos 10 dias) com valores variados, para que os cards "Melhor Dia" e "Menor Dia" no painel de Insights mostrem resultados distintos.

### Dados a Inserir

Todas as vendas usarao:
- `account_id`: `5f2e617d-6d43-4a78-8f26-da5843855caf`
- `product_id`: `a8c6121a-8872-4f61-a971-7fb4bbb95071` (Consulta Premium)
- `responsavel_id`: `eda770a4-79e4-4656-94df-42a23e433f31`
- `status`: `paid`

| # | Contato | Valor | Metodo | Data (created_at / paid_at) |
|---|---------|-------|--------|-----------------------------|
| 1 | CNSLC | R$ 750,00 | credito | 2026-02-14 10:00 |
| 2 | TRANSITAR | R$ 120,00 | dinheiro | 2026-02-16 14:30 |
| 3 | SARAMAGO | R$ 1.500,00 | credito | 2026-02-18 09:15 |
| 4 | Principios | R$ 80,00 | pix | 2026-02-20 16:45 |
| 5 | Walace | R$ 500,00 | boleto | 2026-02-21 11:00 |

### Resultado Esperado

Apos as insercoes:
- **Melhor Dia**: 18/02 com R$ 1.500,00
- **Menor Dia**: 20/02 com R$ 80,00
- **Melhor Dia da Semana**: Quarta-feira (media mais alta)
- **Horario de Pico**: Distribuido entre varios horarios
- O grafico de Area mostrara uma curva com variacao real ao longo de ~10 dias

### Passos Tecnicos

1. Inserir 5 registros na tabela `sales` com datas retroativas via `INSERT`
2. Inserir 5 registros correspondentes na tabela `sale_items` vinculando cada venda ao produto
3. Navegar ate a pagina de Insights e verificar visualmente que os cards mostram valores distintos

Nao sera necessario alterar nenhum codigo -- a logica do `AdminInsightsPage.tsx` ja agrupa por dia e identifica max/min corretamente. O problema atual e apenas falta de dados variados.

