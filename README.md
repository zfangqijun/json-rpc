[![Node.js CI](https://github.com/zfangqijun/json-rpc/actions/workflows/node.js.yml/badge.svg)](https://github.com/zfangqijun/json-rpc/actions/workflows/node.js.yml)
[![Node.js Package](https://github.com/zfangqijun/json-rpc/actions/workflows/npm-publish.yml/badge.svg)](https://github.com/zfangqijun/json-rpc/actions/workflows/npm-publish.yml)

# json-rpc

[JSON-RPC 2.0](https://wiki.geekdream.com/Specification/json-rpc_2.0.html) 协议的JavaScript实现

## 特点

- 弱化client/server，任何一端都可以主动发出`request`和`notification`
- 报文运输层（Transport）可插拔

### 可应用的场景举例

#### 前后端
浏览器 <- WebSocket -> 服务端

#### Electron
Renderer Progress <- WebSocket/IPC -> Main Progress

## 安装和使用

```bash
npm i jsonrpcv2
```

## 使用

### 服务端

```ts
import { WebSocketServer } from 'ws';
import { Rpc } from 'jsonrpcv2';

const serverRpc = new Rpc();

// 注册同步方法
serverRpc.register('syncMethod', () => {
    return 'syncMethod.result';
});

// 注册异步方法
serverRpc.register('asyncMethod', () => {
    return Promise.resolve('asyncMethod.result');
});

const wss = new WebSocketServer({
    port: 2188
});

wss.on('connection', (websocket) => {
    // rpc通过websocket发送消息
    serverRpc.setTransport((message) => {
        return new Promise((resolve, reject) => {
            websocket.send(message, (error) => {
                if (error) {
                    reject(error);
                    return;
                }
                resolve(undefined);
            });
        });
    });
    // websocket接受到消息转发给rpc
    websocket.on('message', (message) => {
        serverRpc.receive(Buffer.from(message).toString());
    });
});
```

### 浏览器

```ts
import { Rpc } from 'jsonrpcv2';

const clientRpc = new Rpc();

const ws = new WebSocket('ws://localhost:2188');

clientRpc.setTransport((message) => {
    ws.send(message);
});

ws.onmessage = function (event) {
    clientRpc.receive(event.data);
};

ws.onopen = function () {
    // 调用服务端syncMethod方法
    clientRpc.invoke('syncMethod')
        .then((result) => {
            console.log(result); // syncMethod.result
        })
        .catch((error) => {
            // error
        });

    // 调用服务端 asyncMethod 方法
    clientRpc.invoke('asyncMethod')
        .then((result) => {
            console.log(result); // asyncMethod.result
        })
        .catch((error) => {
            // error
        })
}
```

## API

### rpc = new Rpc()

```ts
import { Rpc } from 'jsonrpcv2'
const rpc = new Rpc();
```

### rpc.receive(*message*)

接收对端 RPC 报文，报文如何到达取决于你接入的 transport

- `message` {`string`} JSON-RPC 报文
- 如果报文无法被解析为合法 JSON-RPC 消息，会触发 `invalid` 事件

### rpc.setTransport(*transport*)

设置发送 JSON-RPC 报文到对端的 transport

- `transport` {`(message:string)=>unknown|Promise<unknown>`} 发送通道
- transport 可以是同步函数，也可以返回 Promise；发送失败时，`invoke` / `notify` 会返回 rejected Promise

### rpc.register(*methodName*, *method*)

暴露方法，供对端调用

- `methodName` {`string`} 暴露的方法名称
- `method` {`Function`} 方法实例

### rpc.registerAll(*object*)

批量暴露对象上的函数属性，属性名作为方法名

- `object` {`object`} 方法对象

### rpc.registerAll(*array*)

批量暴露方法元组

- `array` {`Array<[string, Function]>`} 方法名称和方法实例

### rpc.unregister(*methodName*)

取消已暴露的方法

- `methodName` {`string`} 已暴露的方法名称

### rpc.clearMethods()

取消所有已暴露的方法

### rpc.invoke(*methodName*,*...args*)

调用对端方法

- `methodName` {`string`} 方法名称
- `args` {`Array`} 参数
- `return` {`Promise<Result>`}
- 对端返回 JSON-RPC error、发送失败时，Promise 会 reject
- 暴露方法返回 `undefined` 时，会按 JSON-RPC 响应为 `null`

### rpc.onNotification(*name*, *callback*)

添加通知监听

- `name` {`string`} 通知名称
- `callback` {`Function`} 通知回调

### rpc.notify(*name*,*...args*)

通知对端

- `name` {`string`} 通知名称
- `args` {`Array`} 参数
- `return` {`Promise<unknown>`} 发送结果；notification 不会等待对端业务响应

### rpc.removeNotification(*name*, *callback*)

删除通知监听

- `name` {`string`} 通知名称
- `callback` {`Function`} 通知回调

### 事件

- `invalid` 收到无效 JSON-RPC 报文时触发
- `sendError` 处理对端 request 后发送 success/error 响应失败时触发

### 兼容旧 API

`RPC`、`setTransmitter`、`expose`、`exposeFromObject`、`exposeFromArray`、`unexpose`、`unexposeAll` 仍然可用，分别对应新的 `Rpc`、`setTransport`、`register`、`registerAll`、`registerAll`、`unregister`、`clearMethods`。
