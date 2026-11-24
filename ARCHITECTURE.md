# Decisões de implementação

## Fronteira de rede

A SPA usa TanStack Router para rotas, busca e proteção; TanStack Query para consultas, mutations e invalidação; Axios para todo o transporte REST da aplicação. O MSW intercepta HTTP e WebSocket antes da montagem do React. Isso também precisa ocorrer antes do import de `socket.io-client`: Engine.IO captura o construtor WebSocket durante a importação.

Um repositório IndexedDB guarda o estado inteiro do servidor demonstrativo. Uma transação de escrita lê, verifica e grava carrinho, reservas, pedidos e idempotência atomicamente. Criptografia, arquivos, rede e timers ficam fora dessa transação. Catálogo, favoritos, perfil, carteiras, cotação, recibo e eventos usam a mesma fonte. BroadcastChannel encaminha eventos de domínio entre abas da mesma origem; cada aba ainda recebe esses eventos pela conexão MSW → Socket.IO → cliente. Não há servidor externo nem coordenação entre navegadores.

## Sessão e isolamento

Senhas fictícias são derivadas com PBKDF2/SHA-256, salt individual e 100 mil iterações; os valores em claro não são persistidos. O token opaco fica em sessionStorage e o servidor guarda seu SHA-256. A sessão expira em 30 minutos do relógio demonstrativo. Refresh consulta `/auth/session` antes do guard privado. Expiração limpa o cache e volta ao login, com destino interno e rascunho de checkout sem senha.

Os recursos privados incluem usuário e geração de sessão na chave Query. Logout/troca cancelam consultas e limpam o cache; respostas iniciadas em outra geração são descartadas. A reconexão do socket cria uma subscription com o token atual, valida proprietário e expiração antes de emitir eventos privados e descarta mensagens de outra geração no cliente. O servidor responde 404 para pedidos alheios. O cenário 403 é distinto e explícito.

Esta é uma simulação inspecionável pelo usuário no próprio navegador. Tokens, Web Crypto e guards locais não constituem uma arquitetura de autenticação de produção. Use apenas dados fictícios.

## Carrinho e dinheiro

O visitante tem identidade local. Ao entrar, o servidor une linhas por NFT + edição, soma quantidades limitadas ao estoque e devolve ajustes. O mergeId é consumido uma vez e o carrinho visitante fica vazio; após a união, uma nova identidade de visitante permite uma futura visita sem reaplicar o merge anterior. Quantidades existentes na conta são preservadas. Códigos e alterações do carrinho são persistidos no servidor demonstrativo, sem persistir o cache Query.

ETH trafega como string decimal com até 18 casas. O domínio converte para Wei BigInt. O desconto de 10% é arredondado para baixo em Wei; a taxa padrão é 0.016 ETH para carrinhos não vazios. A UI apresenta os valores retornados pela API, sem converter dinheiro para Number. Quantidades são inteiras e o estoque é verificado por edição, inclusive sob concorrência.

Ethereum, Polygon e Solana são filtros e redes de carteiras. EVM exige 0x + 40 hexadecimais; Solana exige Base58 que decodifica exatamente 32 bytes. O exercício continua denominado em ETH em todas as redes. Não há conversão monetária. A carteira precisa corresponder à rede de todos os itens. Provedores são simulados; Solana aceita WalletConnect neste transporte.

## Cotação e pedido

Revisar cria uma cotação imutável de 60 segundos com linhas, quantidades, preços, desconto, taxa, total, colecionador e carteira. O servidor verifica novamente versão do carrinho/carteira/edições, estoque, cupom e conexão ao criar o pedido. Alterações invalidam o aceite e exigem revisão explícita.

Uma tentativa é salva antes do POST: userId, chave de idempotência e corpo original. A chave tem escopo por usuário e fingerprint estável do corpo. Mesmo corpo/chave retorna o pedido original antes de verificar a expiração da cotação; corpo diferente responde 409. Timeout não gera uma nova chave. Uma compra pendente bloqueia outra intenção concorrente daquele usuário.

O pedido reserva estoque e fica `pending`. O relógio persistido decide `confirmed` ou `declined`; leituras e tick processam transições vencidas. Estados finais são terminais. Confirmação consome a reserva e subtrai apenas quantidades compradas do carrinho atual, uma vez; recusa libera reserva e mantém itens. Adições posteriores continuam no carrinho. O recibo sempre lê o snapshot do pedido, nunca o preço atual.

## Cache e tempo real

Catálogo/detalhe: staleTime de 30 s. Recursos privados: staleTime 0; coleta após 5 min. Leituras transitórias têm até dois retries (250/500 ms; teto de 2 s), 4xx não têm retry. Mutations não repetem automaticamente. Favoritos usam snapshot, atualização otimista, bloqueio durante envio e rollback. Carrinho e pagamento aguardam a resposta autoritativa. AbortSignal e geração de sessão cancelam/descartam respostas obsoletas. Chaves do catálogo incluem todos os parâmetros.

`nft.updated` e `order.updated` carregam eventId, resourceId, version e occurredAt; o segundo também userId. O cliente descarta IDs repetidos e versões antigas e invalida as consultas afetadas. Nenhum evento financeiro aplica a limpeza do carrinho na UI. Reconexão invalida recursos ativos e consulta REST; a tela de pedido também reconcilia a cada 1,5 s enquanto pendente. Listeners são removidos no cleanup.

O transporte é exclusivamente WebSocket, Engine.IO v4 / Socket.IO v4, namespace `/`. MSW 2.15.0 com `@mswjs/socket.io-binding` 0.2.0 e `socket.io-client` 4.8.4 foram fixados por compatibilidade. O binding publicado oferece `toSocketIo`; sua API difere da branch principal do projeto. O mock envia heartbeat Engine.IO a cada 20 s. O host `.test` nunca recebe conexão externa real. Polling, acknowledgements, payload binário, rooms e namespaces customizados não são implementados.

## Interface e Figma

A identidade KURIO, paleta marrom/cobre, composição monoespaçada e artes dos frames são preservadas. As quatro imagens foram recortadas dos PNGs exportados do Figma; masters PNG e variantes WebP/thumbnail ficam locais. Não há imagem da tela inteira usada como interface. A tipografia interna exata ainda não foi confirmada: DejaVu Sans Mono é uma substituição local licenciada, registrada em `public/assets/FONT-LICENSE.txt`. Isso impede afirmar fidelidade pixel a pixel.

Campos e números inconsistentes nos frames usam dados coerentes com a API. Os números de categorias refletem fixtures reais. Filtros de preço usam inputs explícitos para permitir 18 casas e teclado. As miniaturas mostram enquadramentos da mesma arte, pois não foram fornecidas imagens alternativas do NFT. Perfil, carteiras e confirmação mobile adaptam o desktop. O pagamento mobile tem etapas Dados → Carteira/rede → Revisão; o espaço inferior permite rolar além da barra fixa.

Dialog e Button seguem os padrões shadcn/ui com Radix e class-variance-authority, adaptados à paleta do arquivo. Tailwind fornece base, tokens e utilitários usados pelos componentes; CSS de composição mantém o layout legível. Diálogos usam foco contido e Escape; há labels, erros associados, região de status, foco visível, alt text, skeletons e redução de movimento.

Carteira secundária “igual à principal” salva uma cópia dos campos naquele momento, não uma referência que muda silenciosamente com futuras edições. Desmarcar restaura a edição independente. Newsletter, social login, editorial, recuperação de senha e suporte informam seu escopo, sem aparentar uma operação real concluída. Comprovantes JSON e referências de transação são demonstrativos.

## Publicação e reprodução

O build estático inclui MSW, fontes, imagens e cenários. A hospedagem precisa de fallback SPA para caminhos que não são arquivos, preservando `/mockServiceWorker.js`. `public/_redirects` e `vercel.json` documentam/implementam opções de hospedagem; Sites é a publicação de revisão usada neste ambiente. O código e os assets executam sem o serviço de hospedagem via `npm ci && npm run dev:mocks`.

As medições não removem funcionalidades nem usam uma página especial de auditoria. Configuração, condições, resultados e desvios ficam nos relatórios. Baselines Playwright são da implementação; não constituem uma comparação automática com o arquivo original do Figma.
