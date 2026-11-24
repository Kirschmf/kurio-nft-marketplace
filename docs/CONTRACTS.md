# REST e eventos

Base `/api`. Sucesso: `{ "data": T }`. Erro: `{ "error": { "code": string, "message": string, "fieldErrors"?: Record<string,string[]>, "retryable": boolean, "requestId": string, "details"?: object } }`. ETH é string; quantidade/versão são inteiros. Tipos completos em `src/lib/types.ts`; validações em `src/lib/validation.ts`.

`Authorization: Bearer <token>` identifica a sessão. `X-Demo-Guest-Id` identifica o carrinho visitante. Recursos privados validam sessão no handler; perfil/carteiras/pedidos também validam o dono. `expectedCartVersion` ou `expectedVersion` recusam edições com versão antiga (409).

| Método e caminho                   | Entrada                                                                    | Resposta                                                          |
| ---------------------------------- | -------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| POST /auth/register                | username, email, password, confirmPassword                                 | AuthResult, 201; conflito 409                                     |
| POST /auth/login                   | email, password                                                            | AuthResult; inválido 401                                          |
| GET /auth/session                  | token                                                                      | usuário público, sessionId, expiresAt; expirado 401               |
| POST /auth/logout                  | token                                                                      | null; revoga esta sessão                                          |
| GET /nfts                          | q, categories repetida, networks repetida, minEth, maxEth, sort, tab, page | CatalogResult: items, total, page, pageSize=9, totalPages, facets |
| GET /nfts/:id                      | id                                                                         | Nft; ausente 404                                                  |
| GET /favorites                     | sessão                                                                     | string[] de IDs                                                   |
| PUT /favorites/:id                 | sessão, NFT                                                                | IDs atuais                                                        |
| DELETE /favorites/:id              | sessão, NFT                                                                | IDs atuais                                                        |
| GET /cart                          | identidade                                                                 | CartView: cart, lines, summary, adjustments                       |
| POST /cart/items                   | nftId, editionId, quantity, expectedCartVersion?                           | CartView                                                          |
| PATCH /cart/items/:id              | quantity, expectedCartVersion                                              | CartView                                                          |
| DELETE /cart/items/:id             | expectedCartVersion                                                        | CartView                                                          |
| POST /cart/merge                   | guestCartId, mergeId                                                       | CartView, ajustes; somente autenticado                            |
| PUT /cart/coupon                   | code, expectedCartVersion                                                  | CartView; inválido/expirado 422                                   |
| DELETE /cart/coupon                | expectedCartVersion                                                        | CartView                                                          |
| GET /profile                       | sessão                                                                     | Profile                                                           |
| PATCH /profile                     | displayName, username, email, ensName, walletNickname, expectedVersion     | Profile                                                           |
| PUT /profile/avatar                | multipart file, PNG/JPEG/WebP ≤2 MB                                        | Profile                                                           |
| DELETE /profile/avatar             | sessão                                                                     | Profile com avatar null                                           |
| POST /profile/password             | currentPassword, newPassword, confirmPassword                              | null; revoga outras sessões                                       |
| GET /wallets                       | sessão                                                                     | Wallet[]                                                          |
| POST /wallets                      | campos Wallet sem id/userId/version                                        | Wallet, 201; papel já existente 409                               |
| PATCH /wallets/:id                 | campos Wallet, expectedVersion                                             | Wallet                                                            |
| POST /wallet-connections           | walletId, provider                                                         | connected, walletId, provider                                     |
| DELETE /wallet-connections/current | sessão                                                                     | null                                                              |
| POST /quotes                       | cartVersion, walletId, collectorData                                       | Quote, 201                                                        |
| POST /orders                       | quoteId, walletId, collectorData; header Idempotency-Key                   | Order, 201; reenvio recupera mesmo pedido                         |
| GET /orders/:id                    | sessão e dono                                                              | Order; alheio/ausente 404                                         |
| GET /orders/:id/receipt            | sessão e dono                                                              | Order confirmado; não confirmado 409                              |
| GET /demo/scenarios                | —                                                                          | cenários, configuração e relógio                                  |
| POST /demo/reset                   | scenario, seed?                                                            | seed e scenario restaurados                                       |
| POST /demo/actions                 | type, payload                                                              | configuração atual                                                |

`sort`: recent, price-asc, price-desc, popular. `tab`: all, new, trending. A URL do Router normaliza page inválida para 1 e o servidor limita ao totalPages existente; sort/preço inválidos respondem 422. As listas ficam na URL como arrays JSON do TanStack Router e são convertidas pelo Axios em parâmetros repetidos.

Quote copia os dados do colecionador validados, a carteira e cada linha (lineId, nftId, tokenId, edição, quantity, available, unitPriceEth, lineTotalEth, resourceVersion). Inclui cartVersion, fingerprint, expiresAt, subtotalEth, discountEth, networkFeeEth e totalEth. Order acrescenta id/userId/status, timestamps, resolveAt, transactionRef, version e marcador interno de remoção aplicada. O cliente não calcula confirmação a partir de um timer.

Erros relevantes: `VALIDATION_ERROR` 422, `SESSION_EXPIRED` 401, `FORBIDDEN` 403, `NFT_NOT_FOUND` / `ORDER_NOT_FOUND` 404, `OUT_OF_STOCK` / `QUOTE_CHANGED` / `QUOTE_EXPIRED` / `VERSION_CONFLICT` / `IDEMPOTENCY_CONFLICT` 409, `SERVICE_UNAVAILABLE` 503. Falha de transporte não tem envelope HTTP; a interface mantém a intenção e oferece recuperação.

## Eventos

```json
{
  "eventId": "event-7-1",
  "type": "nft.updated",
  "resourceId": "emerald-042",
  "version": 2,
  "occurredAt": 1795521600000,
  "data": { "editionId": "fifty", "priceEth": "1.29", "available": 50 }
}
```

`order.updated` usa o mesmo envelope, resourceId do pedido, userId do dono e data.status. `subscribe` envia `{token}` ao socket. Duplicatas e versões menores/iguais são ignoradas. O evento serve para invalidar e reconciliar REST; não substitui a cotação nem o snapshot. O domínio emite depois de confirmar a transação. O cliente libera listeners ao trocar sessão/desmontar.

Tipos de ação: `scenario.set`, `clock.advance`, `session.expire`, `nft.change`, `order.resolve`, `socket.disconnect`, `socket.reconnect`. `nft.change` aceita nftId/editionId, priceEth ou available e flags duplicate/old. `order.resolve` aceita orderId e confirmed/declined. Os testes usam essas mesmas rotas MSW; não escrevem diretamente no repositório ou cache da aplicação.
