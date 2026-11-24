# Verificação da entrega

As verificações usam Chromium real com os handlers MSW e o cliente Socket.IO da aplicação. O estado de cada teste é isolado por contexto de navegador e reset do servidor demonstrativo. As oito baselines estão em `tests/e2e/visual.spec.ts-snapshots/` e são comparações da implementação.

`docs/coverage-map.json` relaciona os 84 critérios do planejamento aos arquivos executáveis. T076 é a verificação da publicação; T077 é a instalação limpa/CI; T078 corresponde às 12 medições Lighthouse. O fluxo de tempo real também verifica a região de status acessível (T068).

Antes da publicação, passaram tipos, lint, build e sete testes unitários. A rodada completa inicial teve 105 de 106 execuções aprovadas; a falha expôs um botão coberto pela navegação mobile durante invalidação da cotação. A correção foi seguida de 32 execuções de pedido/compra/socket aprovadas e da atualização das duas baselines de checkout. A execução integral do código final está configurada no workflow `Check application`.

Larguras exercitadas: 390, 768, 1440 e 720 px; fluxo completo de compra em desktop e mobile. A inspeção no Chrome com zoom de 200% confirmou conteúdo de 760 CSS px dentro de viewport de 768 CSS px, sem overflow horizontal. O zoom do navegador foi restaurado.

Os resultados finais de CI, Lighthouse, instalação limpa e publicação serão registrados abaixo após sua conclusão. Não se presume fidelidade pixel a pixel: a fonte exata do Figma permanece por confirmar, e os PNGs de referência não fornecem medidas internas de todos os componentes.
