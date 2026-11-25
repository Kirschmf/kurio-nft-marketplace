# Lighthouse — build final de demonstração

Código da aplicação: 04bde56f5246022f346a6f3c93c168efa08fb734. Árvore limpa, 12 medições seriais em 25/11/2026; três execuções por página/perfil. Lighthouse 13.6.0 e Chromium 159.0.8154.6. Todas as medianas atingiram as metas 90/95/95/90.

| Página | Perfil  | Performance | Acessibilidade | Boas práticas | SEO |    LCP | CLS |    TBT |
| ------ | ------- | ----------: | -------------: | ------------: | --: | -----: | --: | -----: |
| home   | mobile  |          94 |            100 |           100 | 100 | 2.95 s |   0 | 112 ms |
| home   | desktop |         100 |            100 |           100 | 100 | 0.76 s |   0 |   0 ms |
| detail | mobile  |          90 |            100 |           100 | 100 | 3.61 s |   0 |  86 ms |
| detail | desktop |         100 |            100 |           100 | 100 | 0.62 s |   0 |   0 ms |

O summary.json registra cada medição, versões, máquina, commit e condições. Cada execução conserva HTML e JSON. Build de produção com fontes e imagens locais completas, MSW, validações e Socket.IO; perfil de navegador novo em cada medição e limitação simulada padrão do Lighthouse.

A rodada anterior registrava 80/81 no mobile. A versão final pré-renderiza somente dados públicos com o mesmo domínio usado pelos handlers, hidrata a página e reconcilia dados persistidos antes de habilitar os controles. Validações são carregadas por recurso e as imagens têm tamanhos responsivos. Os resultados anteriores permanecem no histórico Git.

As notas são medições desse ambiente, não uma garantia para qualquer máquina ou conexão.
