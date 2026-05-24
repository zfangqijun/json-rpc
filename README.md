[![Node.js CI](https://github.com/zfangqijun/json-rpc/actions/workflows/node.js.yml/badge.svg)](https://github.com/zfangqijun/json-rpc/actions/workflows/node.js.yml)
[![Node.js Package](https://github.com/zfangqijun/json-rpc/actions/workflows/npm-publish.yml/badge.svg)](https://github.com/zfangqijun/json-rpc/actions/workflows/npm-publish.yml)

# jsonrpcv2

A [JSON-RPC 2.0](https://www.jsonrpc.org/specification) library for JavaScript / TypeScript.

Peer-to-peer by design: either side can call the other's methods and push notifications. The transport layer is pluggable — swap in WebSocket, IPC, or anything that sends strings.

## Install

```bash
npm install jsonrpcv2
```

```ts
import { Rpc } from 'jsonrpcv2'
```

## Quick example

```ts
const rpc = new Rpc()

// Expose a method the other side can call
rpc.register('add', (a, b) => a + b)

// Call a method on the other side
const result = await rpc.invoke('add', 3, 4) // 7

// Send a one-way notification
rpc.notify('chat', 'hello')
```

To make it actually talk to another process, wire in a transport:

```ts
rpc.setTransport((message) => ws.send(message))
ws.on('message', (data) => rpc.receive(data.toString()))
```

## Core concepts

**Peer-to-peer.** There is no client / server distinction. Any `Rpc` instance can register methods *and* invoke remote methods. Both sides use the same API.

**Pluggable transport.** `setTransport` accepts any function that sends a string. The matching `receive` feeds incoming strings back in. Common transports: WebSocket, `window.postMessage`, Electron IPC, `process.send`.

**Request → Response.** `invoke(method, ...args)` returns a `Promise<Result>`. If the remote method throws, the promise rejects with a `JsonRpcError`.

**Notification (fire-and-forget).** `notify(name, ...args)` sends a one-way message; no response is expected. Listen on the other side with `onNotification`.

**Error codes.** The library uses standard JSON-RPC error codes. Uncaught handler errors become code `-32000`. Methods that throw a `JsonRpcError` preserve their own code and data.

## API reference

### `new Rpc()`

Creates an instance. Also exported as `RPC` (legacy alias).

```ts
const rpc = new Rpc()
```

### `rpc.register(methodName, handler)`

Expose a method so the remote side can `invoke` it.

- `methodName: string`
- `handler: (...args) => Result | Promise<Result> | void`
- Throws if the method is already registered or if `handler` is not a function.

```ts
rpc.register('ping', () => 'pong')
rpc.register('getUser', async (id) => fetchUser(id))
```

### `rpc.registerAll(source)`

Register multiple methods at once.

**From an object — keys become method names:**

```ts
rpc.registerAll({
  add: (a, b) => a + b,
  subtract: (a, b) => a - b,
})
```

**From an array of `[name, handler]` tuples:**

```ts
rpc.registerAll([
  ['add', (a, b) => a + b],
  ['subtract', (a, b) => a - b],
])
```

Non-function properties in an object are silently skipped.

### `rpc.unregister(methodName)`

Remove a previously registered method. Throws if the method does not exist.

### `rpc.clearMethods()`

Remove all registered methods at once.

### `rpc.invoke(methodName, ...args)`

Call a method on the remote side. Returns `Promise<Result>`.

- The returned Promise **rejects** if: the remote handler throws, the remote returns a JSON-RPC error, or the transport fails to send.
- If the handler returns `undefined`, the caller receives `null` (per JSON-RPC spec).

### `rpc.notify(name, ...args)`

Send a one-way notification. Returns `Promise<unknown>` that resolves when the transport has sent the message; the remote side does not send a response.

```ts
rpc.notify('cursorMoved', { x: 100, y: 200 })
```

### `rpc.onNotification(name, callback)`

Listen for incoming notifications.

```ts
rpc.onNotification('cursorMoved', (pos) => {
  console.log(pos.x, pos.y)
})
```

### `rpc.removeNotification(name, callback)`

Remove a notification listener. The `callback` reference must match the one passed to `onNotification`.

### `rpc.setTransport(transport)` / `rpc.receive(message)`

Wire the RPC instance to a communication channel.

- `setTransport(fn)` — `fn` receives a serialized JSON-RPC string and should send it to the other side. Can be sync or async.
- `receive(msg)` — call this with every incoming string from the other side.

Call `setTransport` once per connection. You can call it again to swap transports.

### Events

`Rpc` extends `EventEmitter`. Two events are emitted:

| Event | When |
|-------|------|
| `'invalid'` | An incoming message failed to parse as valid JSON-RPC |
| `'sendError'` | Sending a response back to the other side failed |

```ts
rpc.on('invalid', (raw) => console.warn('Bad message:', raw))
rpc.on('sendError', (err) => console.error('Send failed:', err))
```

## Examples

### WebSocket (browser ↔ Node server)

**Server (Node):**

```ts
import { WebSocketServer } from 'ws'
import { Rpc } from 'jsonrpcv2'

const rpc = new Rpc()
rpc.register('echo', (s) => s)

const wss = new WebSocketServer({ port: 2188 })
wss.on('connection', (ws) => {
  rpc.setTransport((msg) => new Promise((resolve, reject) => {
    ws.send(msg, (err) => err ? reject(err) : resolve())
  }))
  ws.on('message', (data) => rpc.receive(data.toString()))
})
```

**Browser:**

```ts
import { Rpc } from 'jsonrpcv2'

const rpc = new Rpc()
const ws = new WebSocket('ws://localhost:2188')

ws.onopen = () => {
  rpc.setTransport((msg) => ws.send(msg))
  rpc.invoke('echo', 'hi').then(console.log) // "hi"
}
ws.onmessage = (e) => rpc.receive(e.data)
```

### Electron (renderer ↔ main via IPC)

**Renderer:**

```ts
const { ipcRenderer } = require('electron')
const rpc = new Rpc()
rpc.setTransport((msg) => ipcRenderer.send('rpc', msg))
ipcRenderer.on('rpc', (_, msg) => rpc.receive(msg))
```

**Main process:**

```ts
const { ipcMain } = require('electron')
const rpc = new Rpc()
// ipcMain forwards messages the same way — symmetrical API
```

### Bidirectional communication

Either side can register methods and call remote methods. This means both ends usually set up a mirror pattern:

```ts
// Side A
const rpc = new Rpc()
rpc.register('getData', () => someData)
rpc.setTransport(/* ... */)

// Side B
const rpc = new Rpc()
rpc.setTransport(/* ... */)
const data = await rpc.invoke('getData')
```

## TypeScript types

```ts
import type {
  Rpc,           // the main class (also the default export)
  RpcHandler,    // (...args: unknown[]) => Result | Promise<Result> | void
  Transport,     // (message: string) => unknown | Promise<unknown>
  Result,        // JSONValue
  JSONValue,     // JSONPrimitive | JSONObject | JSONArray
  JSONPrimitive, // string | number | boolean | null
  JSONObject,    // { [key: string]: JSONValue }
  JSONArray,     // JSONValue[]
} from 'jsonrpcv2'
```

## Legacy API (still available)

The old names are kept for backwards compatibility. Prefer the new names in new code.

| Current | Legacy |
|---------|--------|
| `Rpc` | `RPC` |
| `setTransport` | `setTransmitter` |
| `register` | `expose` |
| `registerAll` | `exposeFromObject` / `exposeFromArray` |
| `unregister` | `unexpose` |
| `clearMethods` | `unexposeAll` |

## License

MIT
