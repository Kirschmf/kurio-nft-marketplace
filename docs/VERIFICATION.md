# Verificação da entrega

A suíte contém 53 cenários executados em Chromium desktop e mobile: **106 verificações**, além de sete testes unitários e oito baselines visuais versionadas. Todos usam os handlers MSW e o cliente Socket.IO da aplicação. Cada teste começa em contexto isolado e reinicia o servidor demonstrativo.

[Execuções integrais em instalação limpa](https://github.com/Kirschmf/kurio-nft-marketplace/actions/workflows/checks.yml). O workflow instala dependências, executa tipos, lint, unitários, build e Playwright, e disponibiliza relatório HTML e traces de falhas como artifacts. O código da aplicação auditado corresponde ao commit `6752b16832c6980c0868cb1fc3cc257f48a8df5f`; os commits seguintes de testes/documentação não alteram seu comportamento. As melhorias de carregamento também foram conferidas por oito capturas visuais e 16 verificações de qualidade, além dos 32 testes de pedido/compra/socket.

## Cobertura

`docs/coverage-map.json` relaciona os 84 critérios do planejamento aos arquivos executáveis. T076 corresponde ao smoke publicado; T077 à instalação limpa do workflow; T078 aos relatórios Lighthouse. O fluxo de eventos verifica também a região de status acessível (T068).

Larguras exercitadas: 390, 768, 1440 e 720 px. Compra completa em desktop e mobile, incluindo visitante → login → revisão → pedido confirmado → refresh → recibo. A inspeção no Chrome com zoom de 200% confirmou conteúdo de 760 CSS px dentro de viewport de 768 CSS px, sem overflow horizontal. O zoom foi restaurado.

Depois da publicação, os mesmos testes de smoke podem ser executados contra a URL hospedada, com MSW ativo no build:

```powershell
$env:PLAYWRIGHT_BASE_URL='https://kurio-colecoes-matheus.famousbrush11.chatgpt.site'
npx playwright test smoke.spec.ts
```

Em shells POSIX, prefixe o comando com `PLAYWRIGHT_BASE_URL=https://kurio-colecoes-matheus.famousbrush11.chatgpt.site`. Isso cobre acesso direto a detalhe, carrinho, login, checkout, pedido, refresh e atualização pelo socket. O manifesto publicado e o repositório recebem o mesmo commit pelo processo de empacotamento.

## Lighthouse

[Relatórios completos e análise](../evidence/lighthouse/README.md): 12 medições (duas páginas × dois perfis × três execuções), HTML/JSON, versões, ambiente, medianas, LCP, CLS e TBT. As medições mantêm fontes, imagens, MSW, dados e eventos da entrega.

| Página  | Perfil  | Performance | Acessibilidade | Boas práticas | SEO |
| ------- | ------- | ----------: | -------------: | ------------: | --: |
| Início  | Desktop |         100 |            100 |           100 | 100 |
| Detalhe | Desktop |          99 |            100 |           100 | 100 |
| Início  | Mobile  |          80 |            100 |           100 | 100 |
| Detalhe | Mobile  |          81 |            100 |           100 | 100 |

A meta de performance mobile (90) não foi atingida. O LCP mediano fica perto de 4,3 s, com CLS zero e TBT de 227–253 ms. O relatório identifica a inicialização dos módulos e mocks na cadeia crítica e registra as próximas otimizações sem omitir a limitação.

## Limites da verificação

As baselines são da implementação; não substituem comparação com o arquivo original. A fonte exata do Figma ainda não foi confirmada: há substituição local licenciada e documentada. Os testes mobile usam emulação Chromium, não dispositivos Android/iOS físicos. Nenhum resultado certifica segurança de produção, transações reais ou integrações blockchain, que estão fora do escopo.
