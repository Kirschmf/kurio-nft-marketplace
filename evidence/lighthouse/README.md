# Lighthouse — build de demonstração

Mediana de três medições por página e perfil. Lighthouse 13.6.0; Chromium 159.0.8154.6; build otimizado, assets locais completos, MSW e Socket.IO ativos. Condições e todas as medições estão em `summary.json`; cada execução tem HTML e JSON.

| Página | Perfil  | Performance | Acessibilidade | Boas práticas | SEO |    LCP |   CLS |    TBT |
| ------ | ------- | ----------: | -------------: | ------------: | --: | -----: | ----: | -----: |
| home   | mobile  |          80 |            100 |           100 | 100 | 4.31 s | 0.000 | 253 ms |
| home   | desktop |         100 |            100 |           100 | 100 | 0.81 s | 0.000 |   8 ms |
| detail | mobile  |          81 |            100 |           100 | 100 | 4.34 s | 0.000 | 227 ms |
| detail | desktop |          99 |            100 |           100 | 100 | 0.90 s | 0.000 |   0 ms |

As três categorias de qualidade atingem a meta em todos os perfis. Performance desktop atinge 99–100. **Performance mobile fica abaixo da meta de 90: 80 no início e 81 no detalhe.**

Os relatórios mostram LCP em torno de 4,3 s no perfil mobile simulado, com CLS zero e TBT de 227–253 ms. A cadeia crítica inclui carregar/inicializar React, Router, Query, Axios, MSW, os handlers de domínio/validação e o cliente de eventos antes das consultas. O preload das artes evita atraso de descoberta da imagem; a reserva de espaço removeu o CLS do detalhe. O custo restante está principalmente na inicialização e no JavaScript sob a limitação mobile. Esta atribuição é uma interpretação da cadeia de dependências, dos long tasks e da decomposição de LCP nos relatórios.

Não foram desativados mocks, fontes, imagens, validações ou eventos para a auditoria. Uma próxima otimização deve dividir handlers/validações por recurso e reduzir o caminho de inicialização, mantendo a prova de protocolo e os mesmos fluxos. As metas abaixo do esperado permanecem registradas, sem substituir os resultados por medições sem limitação de CPU/rede.
