

## Usar logo branca na tela de login

A tela de login usa fundo escuro (classe `dark`), então faz sentido usar a versão branca do logo. O logo atual (`mychooice-logo.svg`) é a versão completa com as 3 variantes — precisa trocar para `mychooice-logo-white.svg` que já existe no projeto.

### Alterações

**`src/pages/LoginPage.tsx`** (linha 9 e linhas 104-111):
1. Trocar import de `mychooice-logo.svg` para `mychooice-logo-white.svg`
2. Remover `rounded-xl` (que criava aparência de "fundo") e ajustar o tamanho para exibir o logo mais largo (é um logo horizontal, não quadrado)
3. Mudar de `w-20 h-20` para algo como `w-48 h-16` para respeitar o aspect ratio horizontal do logo

