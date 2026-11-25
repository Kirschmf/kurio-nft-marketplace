# Decisões de implementação

## Fronteira de rede

A SPA usa TanStack Router para rotas, busca e proteção; TanStack Query para consultas, mutations e invalidação; Axios para todo o transporte REST da aplicação. A inicialização de MSW começa em paralelo à interface. Toda chamada Axios aguarda a barreira de rede, e o import de `socket.io-client` aguarda essa mesma barreira: Engine.IO captura o construtor WebSocket durante a importação.

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

A identidade KURIO, a paleta marrom/cobre e a composição monoespaçada seguem os 15 frames exportados. O SVG nativo confirma **Roboto Mono**. Os arquivos regular/medium/bold são locais, com subset dos caracteres usados em português e licença SIL OFL em `public/assets/FONT-LICENSE.txt`. Os quatro PNGs originais de 1254 × 1254, extraídos dos SVGs sem recompressão, estão em `assets/figma/`; WebP de 450/900 px e miniaturas atendem aos tamanhos de exibição. Os cinco ícones de login/provedores também vieram do arquivo. `docs/assets.json` registra origem, operações e hashes; `docs/figma-reference.json` registra tipografia e posições dos 15 frames. Nenhuma tela inteira é usada como interface.

A comparação visual é manual, apoiada nessas medidas e nas capturas da implementação. Não há promessa de igualdade pixel a pixel: dados preenchidos, validações, estados assíncronos e controles de demonstração mudam a altura das páginas. Bordas de campos e foco têm contraste mais forte. A ordenação permanece disponível no mobile; controles de adicionar, remover e favoritar continuam explícitos. Não reproduzimos avaliações numéricas sem fixtures que as sustentem.

Campos e números inconsistentes nos frames usam dados coerentes com a API. Os números de categorias refletem fixtures reais. Filtros de preço usam inputs explícitos para permitir 18 casas e teclado. As miniaturas mostram enquadramentos da mesma arte, pois não foram fornecidas imagens alternativas do NFT. Perfil, carteiras e confirmação mobile adaptam o desktop. O pagamento mobile tem etapas Dados → Carteira/rede → Revisão; o espaço inferior permite rolar além da barra fixa.

Dialog e Button seguem os padrões shadcn/ui com Radix e class-variance-authority, adaptados à paleta do arquivo. Tailwind fornece base, tokens e utilitários usados pelos componentes; CSS de composição mantém o layout legível. Diálogos usam foco contido e Escape; há labels, erros associados, região de status, foco visível, alt text, skeletons e redução de movimento.

Carteira secundária “igual à principal” salva uma cópia dos campos naquele momento, não uma referência que muda silenciosamente com futuras edições. Desmarcar restaura a edição independente. Newsletter, social login, editorial, recuperação de senha e suporte informam seu escopo, sem aparentar uma operação real concluída. Comprovantes JSON e referências de transação são demonstrativos.

## Publicação e reprodução

O build estático inclui MSW, fontes, imagens e cenários. `npm run build` também pré-renderiza o catálogo e os 36 detalhes públicos usando a mesma consulta de domínio e o seed dos handlers. O adaptador SSR oficial do TanStack Router produz o HTML, estado de rota e hidratação React. Apenas consultas públicas `catalog`/`nft` entram no HTML: sessão, carrinho, perfil, carteira e pedido não são serializados. Não existe resposta fictícia de negócio em componente ou cliente Axios.

A pré-renderização é uma melhoria para todos os visitantes, sem detecção de Lighthouse. O HTML inicial usa `inert` até a hidratação e a rede estarem prontas; controles visíveis não recebem cliques sem seus handlers. O CSS de produção é incorporado ao HTML; imagens e fontes locais são pré-carregadas conforme a rota. Com parâmetros de busca ou sessão existente, a aplicação monta a SPA normalmente. Após iniciar MSW, invalida o snapshot público e reconcilia o IndexedDB daquele navegador. Ações aguardam a rede; a cotação e o pedido sempre passam pelo servidor demonstrativo. `VITE_API_MODE=remote` não gera snapshots dos mocks.

O build grava detalhes como `nfts/:id/index.html` e `nfts/:id.html` para hosts com resoluções distintas. A hospedagem precisa servir arquivos existentes antes do fallback SPA, preservando `/mockServiceWorker.js`. `public/_redirects` e `vercel.json` documentam opções; Sites é a publicação de revisão. O projeto executa sem esse serviço via checkout limpo.

As medições carregam todas as funcionalidades, fontes e imagens. O runner mede três vezes cada página/perfil, registra o commit e se o checkout estava limpo e termina com erro se qualquer mediana ficar abaixo das metas. As baselines Playwright são da implementação; a comparação com os originais do Figma é separada.
