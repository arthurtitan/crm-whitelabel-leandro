
## Análise Atual: Gráfico de Pico de Atendimento por Hora

### Estado Verificado ✓
1. **Componente**: `HourlyPeakChart.tsx` - Implementado com `AreaChart` (wave format) ✓
2. **Dados Reais do Chatwoot**: A propriedade `picoPorHora` vem da Edge Function `fetch-chatwoot-metrics` ✓
3. **Fluxo de Dados**:
   - AdminDashboard.tsx → useChatwootMetrics hook
   - Hook chama fetch-chatwoot-metrics Edge Function
   - Edge Function retorna `picoPorHora` com agregação real de conversas por hora
   - HourlyPeakChart consome `displayedData.picoPorHora`

### Dados Confirmados (Network Request)
Última resposta do Chatwoot mostrou:
```json
{
  "picoPorHora": [
    {"hora": 7, "totalConversas": 0},
    {"hora": 8, "totalConversas": 0},
    ...
    {"hora": 11, "totalConversas": 4},  // Pico em 11h
    {"hora": 12, "totalConversas": 0},
    ...
  ]
}
```

### Observações Técnicas
1. **Intervalo de Horas**: Atualmente limitado a 7h-21h (horário comercial)
2. **Formato do Gráfico**: Já está em wave (AreaChart com linearGradient)
3. **Dados**: Vêm de conversas reais do Chatwoot, não de eventos genéricos
4. **Tooltip**: Mostra hora e quantidade de conversas
5. **Responsividade**: Altura adaptável (200px mobile / 250px desktop)

### Possíveis Melhorias Sugeridas (Não Críticas)

**Opção A - Expandir Horário**
- Incluir todas as 24 horas em vez de 7h-21h
- Ajustar `interval` no XAxis para melhor legibilidade

**Opção B - Realçar Pico Máximo**
- Destacar a hora com maior volume de conversas
- Adicionar visual indicator no gráfico

**Opção C - Contexto no Tooltip**
- Mostrar percentual do total de conversas do dia
- Adicionar comparação com dia anterior (se dados existirem)

### Conclusão
✅ O gráfico está **funcionando corretamente** com dados reais do Chatwoot. O `picoPorHora` que você vê no gráfico é a agregação real de conversas da API do Chatwoot, agrupadas por hora. Nenhuma mudança é necessária a menos que você queira expandir o horário ou adicionar visualizações extras.

