# Socket.IO simulado (MSW)

O tempo real passa de verdade pelo `socket.io-client`: a aplicação abre um WebSocket,
o MSW o intercepta **na página** (não no Service Worker) e `src/mocks/socket.ts`
responde com o protocolo Engine.IO v4 / Socket.IO v5 via `@mswjs/socket.io-binding@0.2.0`.
Nenhum componente ou hook chama setters ou o cache diretamente para simular eventos.

```
handlers REST (mudam o db) ──► mockEvents.emit() ──► socket.ts ──► WebSocket ──► socket.io-client
                                                         ▲                            │
                       POST /__mock/socket/emit ─────────┘        src/realtime/apply-events.ts ──► Query cache
```

## Transporte

- **Somente WebSocket.** O binding não simula long-polling (não há servidor HTTP de
  Engine.IO), então o cliente usa `transports: ['websocket']`. Sem isso o cliente
  tentaria `GET /socket.io/?transport=polling` e falharia.
- **URL.** `VITE_SOCKET_URL` (padrão `ws://localhost/socket`). No `io(url)` o caminho da
  URL vira _namespace_, não caminho HTTP; por isso `src/realtime/socket-url.ts` separa a
  URL em origem + `path`: o cliente abre
  `ws://localhost/socket/socket.io/?EIO=4&transport=websocket` no namespace `/`, e o
  handler escuta `ws.link('ws://localhost/socket/*')` (o MSW ignora a query no match).
  Nada sai para a rede: a porta 80 nunca é contatada.
- **Ordem de carga.** O engine.io-client guarda `globalThis.WebSocket` quando o módulo é
  avaliado. O interceptor do MSW só é aplicado em `worker.start()`. Por isso
  `socket.io-client` é carregado com `import()` dentro de `connectRealtime()`, depois de
  `startMocks()`; um import estático escaparia do mock.
- **Handshake.** Sem servidor real, o binding envia sozinho o `open` do Engine.IO
  (`pingInterval: 25000`, `pingTimeout: 5000`) e o `CONNECT` do namespace `/`.
- **Heartbeat.** O binding não envia pings. `socket.ts` manda o frame `2` (ping) a cada
  20 s; o cliente responde `3` (pong). Sem isso o cliente derrubaria a conexão após 30 s.

## O que o binding não suporta e como contornamos

| Limitação                        | Contorno                                                                                                                                                              |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Namespaces (emite sempre em `/`) | Um único namespace `/`; a URL é separada em origem + `path` para o caminho não virar namespace.                                                                       |
| Rooms / broadcast seletivo       | `socket.ts` guarda cada conexão num `Set` com o `userId` vindo de `session.bind`; `order.updated` só vai para conexões daquele usuário, `nft.updated` vai para todas. |
| Acks (callbacks de `emit`)       | Não usados. `session.bind` é "fire and forget" e reenviado a cada `connect`; o cliente filtra `order.updated` pelo usuário atual de qualquer forma.                   |
| Binário (Blob/ArrayBuffer)       | Todos os payloads são JSON (strings decimais para ETH).                                                                                                               |
| Long-polling e upgrade           | Apenas WebSocket (ver acima).                                                                                                                                         |
| Várias abas                      | Cada aba tem seu próprio servidor simulado e seu próprio `Set` de conexões: eventos gerados numa aba não chegam às outras (elas se atualizam pelo REST).              |

## Desconexão e reconexão

- `POST /__mock/socket/disconnect` fecha todas as conexões **do lado do servidor**
  (`connection.client.close()`). Para o cliente é um _transport close_: o status vai para
  `reconnecting`, o Manager reconecta sozinho (500 ms a 3 s com backoff) e, no `connect`
  seguinte, o cliente reenvia `session.bind` e invalida `['nfts']`, `['cart']`,
  `['orders']` e `['quote']` com `refetchType: 'active'` para reconciliar com o REST o
  que pode ter sido perdido enquanto estava fora.
- Recarregar a página equivale a uma conexão nova: o estado vem do REST (db persistido).
- `GET /__mock/socket/state` devolve `{ connected, clients: [{ userId }] }`.
- `POST /__mock/socket/emit` com `{ event, payload }` envia um evento cru para todas as
  conexões, sem filtro de usuário. Serve para os testes injetarem duplicatas, versões
  antigas e eventos de outro usuário e provarem que o **cliente** os descarta.

## Garantias do lado do cliente (`src/realtime`)

- **Duplicata** (`eventId` já visto, LRU de 500): ignorada.
- **Versão antiga** (`version` <= última aceita para o recurso, ou <= versão no cache):
  ignorada; o cache nunca regride. Pedido confirmado/recusado é terminal.
- **Recurso fora do cache:** ignorado em silêncio (nada a atualizar).
- **Evento durante um fetch:** o `setQueryData` aplica se a versão for maior, e a query
  em andamento é reiniciada (invalidate cancela a anterior), para que a resposta que a
  query aceita seja posterior ao evento e traga sua própria versão.
- **Outro usuário:** `order.updated` com `userId` diferente do usuário com token válido é
  ignorado. No logout/expiração o log de eventos e os avisos são limpos e o socket refaz
  `session.bind` com token `null`; na troca de usuário o log é limpo.
- **StrictMode / ciclo de vida:** `connectRealtime()`/`disconnectRealtime()` são
  idempotentes; o cleanup de `useRealtime()` remove todos os listeners e desconecta.
  Nenhum socket é criado no import do módulo.
