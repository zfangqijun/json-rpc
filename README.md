[![Node.js CI](https://github.com/zfangqijun/json-rpc/actions/workflows/node.js.yml/badge.svg)](https://github.com/zfangqijun/json -rpc/actions/workflows/node.js.yml)
[![Node.js Package](https://github.com/zfangqijun/json-rpc/actions/workflows/npm-publish.yml/badge.svg)](https://github.com/zfangqijun/json -rpc/actions/workflows/npm-publish.yml)

# json-rpc

[JSON-RPC 2.0](https://wiki.geekdream.com/Specification/json-rpc_2.0.html) JavaScript implementation of the protocol, compatible with Node and Web

- Weakening client/server, any end can actively send requests and notifications
- Provides a simple and easy-to-use Promise interface
- Not limited to Web/Node, such as: WebView/Native

## What have you done

- Parse JSON-PRC 2.0 data packets, and provide interfaces such as method exposure and invocation

## do nothing

## Install and use

```bash
npm i jsonrpcv2
````

## use

### Server

```ts
import { WebSocketServer } from 'ws';
import { RPC } from 'jsonrpcv2';

const serverRPC = new RPC();

// register synchronization method
serverRPC.expose('syncMethod', () => {
    return 'syncMethod.result';
});

// register async method
serverRPC.expose('asyncMethod', () => {
    return Promise.resolve('asyncMethod.result');
});

const wss = new WebSocketServer({
    port: 2188
});

wss.on('connection', (websocket) => {
    // rpc sends messages via websocket
    serverRPC.setTransmitter((message) => {
        websocket.send(message);
    });
    // websocket receives the message and forwards it to rpc
    websocket.on('message', (message) => {
        serverRPC.receive(Buffer.from(message).toString());
    });
});
````

### WebView

```ts
import { RPC } from 'jsonrpcv2';

const clientRPC = new RPC();

// web's websocket native object
const ws = new WebSocket('localhost:2188');
ws.onopen = function () {
    // Call the server syncMethod method
    clientRPC.call('syncMethod')
        .then((result) => {
            console.log(result); // syncMethod.result
        })
        .catch((error) => {
            // error
        });

    // Call the server asyncMethod method
    clientRPC.call('asyncMethod')
        .then((result) => {
            console.log(result); // asyncMethod.result
        })
        .catch((error) => {
            // error
        })
}
````

##API

### rpc = new RPC()

```ts
import { RPC } from 'jsonrpcv2'
const rpc = new RPC();
````

### rpc.receive(*message*)

The RPC message of the opposite end is notified to the local RPC through this method

- `message` {`string`} JSON RPC message

### rpc.setTransmitter(*transmitter*)

The RPC message to the peer is sent from here, how the message is relaxed to the peer depends on your transmitter

- `transmitter` {`(message:string)=>Promise`} send channel

### rpc.expose(*methodName*, *method*)

Expose the method for the peer to call

- `methodName` {`string`} exposed method name
- `method` {`Function`} method instance
  > According to [JSON-RPC 2.0](https://wiki.geekdream.com/Specification/json-rpc_2.0.html) standard, parameters of exposed methods support index and name association, jsonrpcv2 currently only supports index

### rpc.unexpose(*methodName*)

Cancel an exposed method

- `methodName` {`string`} exposed method name

### rpc.call(*methodName*,*args*)

call peer method

- `methodName` {`string`} method name
- `args` {`Array` | `Object`} arguments, index (Array) or name association (Object)
- `return` {`Promise<Result>`}

### rpc.onNotification(*name*, *callback*)

Add notification listener

- `name` {`string`} notification name
- `callback` {`Function`} notification callback

### rpc.removeNotification(*name*, *callback*)

delete notification listener

- `name` {`string`} notification name
- `callback` {`Function`} notification callback

### rpc.notify(*name*,*args*)

Notify the peer

- `name` {`string`} notification name
- `args` {`Array` | `Object`} arguments, index (Array) or name association (Object)