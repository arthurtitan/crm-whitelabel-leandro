

# Plano: Corrigir Erro 403 do Google OAuth no Preview

## Problema Identificado

O erro 403 acontece porque você está testando no **preview do editor** (iframe). O Google bloqueia fluxos OAuth que acontecem dentro de iframes por segurança.

O código atual usa `window.location.href` para redirecionar, o que navega dentro do iframe ao invés de abrir em uma nova aba.

## Solução

Modificar o código para abrir o fluxo OAuth em uma **nova aba** ao invés de tentar navegar dentro do iframe.

## Alterações Necessárias

### Arquivo: `src/contexts/CalendarContext.tsx`

**Linha ~197** - Alterar de:
```typescript
window.location.href = response.data.authUrl;
```

**Para:**
```typescript
window.open(response.data.authUrl, '_blank');
```

Isso vai abrir a página de autorização do Google em uma nova aba, onde o OAuth funciona normalmente.

### Comportamento Esperado Após a Correção

1. Usuário clica em "Continuar com Google"
2. Nova aba abre com a página de login do Google
3. Usuário autoriza o app
4. Google redireciona para o callback
5. Callback salva os tokens e redireciona para `/admin/agenda?google_connected=true`
6. Usuário fecha a aba e volta ao preview

### Consideração Adicional

Como o callback redireciona para o site publicado (`testedocrm.lovable.app`), o usuário precisará verificar a conexão manualmente no preview após completar o fluxo na nova aba. Podemos adicionar um botão "Verificar Conexão" ou detectar automaticamente quando a aba é fechada.

---

## Resumo Técnico

| Item | Detalhe |
|------|---------|
| Arquivo modificado | `src/contexts/CalendarContext.tsx` |
| Linha alterada | ~197 |
| Mudança | `window.location.href` → `window.open(..., '_blank')` |
| Impacto | OAuth abre em nova aba, evitando bloqueio do iframe |

