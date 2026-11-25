# Verificação da entrega

A suíte define 67 cenários em Chromium desktop e mobile: **134 verificações**, 12 testes unitários e oito baselines visuais versionadas. REST passa pelos handlers MSW e eventos pelo cliente Socket.IO. Os contextos são isolados e o seed é reiniciado em cada teste. O relatório HTML e os traces de falhas ficam nos artifacts da [execução em checkout limpo](https://github.com/Kirschmf/kurio-nft-marketplace/actions/workflows/checks.yml).

O workflow usa `npm ci`, instala Chromium, executa tipos, lint, unitários, build e a suíte inteira contra o preview de produção. A auditoria Lighthouse é um comando separado, com execução serial e perfil novo por medição.

## Cobertura verificável

`coverage-map.json` relaciona os 84 critérios aos títulos, arquivos, linhas e asserções dos testes. T076 usa os mesmos testes de smoke/startup na URL publicada; T077 corresponde à instalação limpa da CI; T078 aos 12 relatórios Lighthouse e suas medianas. Esses gates têm evidência externa ao teste E2E, não são contados como cenários adicionais.

Há compra completa apenas com Tab/Enter, contenção/restauração de foco em login e drawer, erros associados aos campos, contraste/semântica via axe nas nove telas e favoritos, shimmer normal e preferência por movimento reduzido. A matriz de layout cobre 390, 414, 768, 1440 e 720 px em todas essas telas. O checkout com 390 × 420 testa campos focados, rolagem e confirmação com altura disponível reduzida. Isso não equivale a testar um teclado físico de celular.

A conferência no Chrome com zoom real de 200% não apresentou overflow horizontal no catálogo; a ampliação foi restaurada. A matriz de largura reduzida cobre as demais telas. A conferência dos 15 frames e as diferenças de UX estão em [FIGMA.md](FIGMA.md); baselines da aplicação não substituem essa comparação.

A regressão de startup verifica HTML público, ausência de dados privados serializados, hidratação sem erro e reconciliação de preço/carrinho alterados antes de recarregar. As regressões de sessão seguram respostas 200/401 e um evento privado até a troca de conta; a nova conta mantém seus próprios dados.

## Publicação

Depois de publicar o mesmo commit:

```powershell
$env:PLAYWRIGHT_BASE_URL='https://kurio-colecoes-matheus.famousbrush11.chatgpt.site'
npx playwright test smoke.spec.ts startup.spec.ts
```

Isso verifica catálogo → detalhe → carrinho visitante → login → compra confirmada → recibo/refresh, atualização de preço pelo socket e startup com dados persistidos. Guards, rotas inexistentes, contas e erros também fazem parte da suíte completa local/CI. O registro de entrega identifica o commit publicado e a versão salva pelo host.

## Lighthouse

[Relatórios HTML/JSON e medianas](../evidence/lighthouse/README.md). O comando mede duas páginas × dois perfis × três execuções com build de produção e cenário padrão. Registra versões, ambiente, commit, LCP, CLS e TBT. As metas 90/95/95/90 são verificadas pelo runner; qualquer mediana abaixo delas produz saída de erro.

## Limites

Os resultados mobile são emulação Chromium. A demonstração não integra blockchain, gateways ou autenticação de produção. Todos os dados e credenciais são fictícios. A referência tipográfica foi confirmada como Roboto Mono e as quatro artes originais foram preservadas; desvios restantes estão descritos por frame. Os relatórios verificam comportamentos e condições reproduzíveis, sem garantir nota do avaliador ou ausência absoluta de defeitos.
