# Kurio

Marketplace de NFTs do desafio frontend da Jungle Gaming. React, TypeScript e Vite; dados, contas, carteiras e pagamentos são simulados na camada de rede.

Código: [Kirschmf/kurio-nft-marketplace](https://github.com/Kirschmf/kurio-nft-marketplace).

![Kurio no desktop](docs/screenshots/home-desktop.png)

## Executar

Requer Node 22.19+ e npm 10+. Em um checkout limpo:

```sh
npm ci
npx playwright install chromium
npm run dev:mocks
```

Abra `http://127.0.0.1:5173`. O service worker exige localhost ou HTTPS. Não é necessário backend, extensão de carteira, API key ou conta em serviço privado.

```sh
npm run typecheck
npm run lint
npm test
npm run build
npm run preview -- --port 4173
npm run test:e2e
npm run test:visual
npm run audit:lighthouse
```

Feche o preview antes da auditoria: ela inicia e encerra seu próprio servidor em 4173. Para revisar baselines intencionalmente: `npm run test:visual -- --update-snapshots`. Os relatórios ficam em `playwright-report/`, traces de falhas em `test-results/` e as 12 medições Lighthouse em `audit-results/`. Nenhum teste altera serviços externos.

## Contas fictícias

| Conta | E-mail                   | Senha               |
| ----- | ------------------------ | ------------------- |
| Alex  | collector.a@example.test | CollectorDemoA!2026 |
| Bia   | collector.b@example.test | CollectorDemoB!2026 |

Cada conta começa com carteiras principal e secundária editáveis. Novas contas podem cadastrar as duas no menu de carteiras. Endereços e nomes ENS são fictícios; a conexão apenas simula um provedor.

## Configuração

As opções de `.env.example` são públicas e não contêm segredos. O padrão inicia MSW também no build de demonstração. `VITE_API_MODE=remote` desativa os mocks e pressupõe um backend que implemente os contratos de `docs/CONTRACTS.md`; esse backend não faz parte da entrega. `VITE_SCENARIO` seleciona o primeiro seed de um navegador novo; não sobrescreve dados já persistidos. `VITE_DEMO_CONTROLS=false` esconde os controles de demonstração.

Use a engrenagem no canto da tela para selecionar cenários, alterar preço/estoque, expirar sessão, avançar o relógio, interromper o socket ou resolver um pedido. **Aplicar cenário** preserva os dados e troca a condição de falha. **Reiniciar dados** restaura catálogo, credenciais, sessões, favoritos, carrinhos, carteiras, cotações, pedidos, reservas e versões. A persistência é local ao navegador/origem; nenhum dado é sincronizado entre dispositivos.

## Reproduzir falhas

1. **Carregamento e erro:** aplique `slow` e abra catálogo, detalhe ou carrinho. `server-error` falha nas três primeiras leituras de cada recurso: os dois retries se esgotam e o botão de nova tentativa recupera a consulta. `offline` falha na primeira requisição de cada operação; `out-of-order` atrasa mais a busca curta que a longa.
2. **Formulários e conta:** use e-mail/username já existentes para conflito; `validation` recusa dados de perfil/carteira sem gravá-los; `forbidden` responde 403 nesses recursos. **Expirar sessão** seguido de uma consulta privada leva ao login e mantém o contexto de checkout.
3. **Cupons:** `WELCOME10` concede 10%; `EXPIRED10` está expirado; outros códigos são inválidos. `expired-coupon` invalida um cupom que já estava aplicado ao revisar a compra.
4. **Preço e estoque:** adicione Emerald ao carrinho e abra pagamento. Conecte uma carteira e revise. Em outra aba da mesma origem, ou na engrenagem, use **Alterar preço** ou **Esgotar edição**. O socket invalida os recursos; a revisão anterior deixa de autorizar a compra. Mesmo sem evento, a criação revalida as versões na transação.
5. **Timeout idempotente:** aplique `order-timeout` antes de confirmar. O pedido é criado, mas a primeira resposta excede os cinco segundos do Axios. Recarregue e escolha **Recuperar tentativa de compra**. A chave e o corpo originais recuperam o mesmo pedido, inclusive depois de a cotação expirar.
6. **Recusa e reconexão:** `payment-declined` resolve a compra como recusada e preserva o carrinho. **Interromper socket** fecha a conexão; **Restabelecer socket** libera a reconexão e a reconciliação REST. A rota `/orders/:id` permite recuperar pedidos pendentes após refresh.
7. **Carteiras:** `wallet-refused` recusa a conexão; `wallet-disconnected` recusa a criação. Volte ao cenário padrão e reconecte para retomar. Um carrinho com redes diferentes exige compras separadas.
8. **Eventos:** **Evento duplicado** envia duas vezes o mesmo `eventId`; **Evento antigo** envia uma versão anterior depois da nova. A interface mantém o valor mais recente. O contador no painel indica eventos aceitos pelo cliente.

Os demais nomes do seletor identificam receitas de teste: `duplicate-account`, `invalid-coupon`, `user-switch`, `concurrent-order`, `idempotency-conflict`, `partial-cart`, `immutable-receipt`, `network-conflict`, `repeat-merge` e `terminal-order` usam as operações descritas acima e as sequências executáveis de `tests/e2e/`. `session-expired` e `checkout-expired` usam **Expirar sessão** no contexto correspondente; `price-change`, `sold-out`, `duplicate-event`, `old-event` e `pending-disconnect` usam os controles homônimos. Selecionar uma receita não executa uma compra nem apaga dados silenciosamente. `last-unit` deve ser reiniciado para aplicar estoque unitário; `not-found`, `empty`, `quote-expired` e `favorite-error` alteram diretamente a resposta correspondente.

## Estrutura

`src/pages/` contém as telas. `src/lib/` reúne contratos, cliente Axios, sessão, regras de validação, dinheiro e reconciliação. `src/mocks/` implementa o servidor demonstrativo: REST/MSW, binding Socket.IO, fixtures e repositório IndexedDB único. Os componentes não importam o repositório nem recebem dados fictícios diretamente.

Leia `ARCHITECTURE.md` para as decisões e limites, `docs/CONTRACTS.md` para o transporte e `docs/VERIFICATION.md` para a cobertura e as evidências da entrega.
