[![Node.js CI](https://github.com/zfangqijun/json-rpc/actions/workflows/node.js.yml/badge.svg)](https://github.com/zfangqijun/json-rpc/actions/workflows/node.js.yml)
[![Node.js Package](https://github.com/zfangqijun/json-rpc/actions/workflows/npm-publish.yml/badge.svg)](https://github.com/zfangqijun/json-rpc/actions/workflows/npm-publish.yml)

# json-rpc

[JSON-RPC 2.0](https://wiki.geekdream.com/Specification/json-rpc_2.0.html) 协议的JavaScript实现，兼容Node和Web

- 弱化client/server，任何一端都可以主动发出request和notification
- 提供简单、易用的Promise接口
- 不仅限于Web/Node，如：WebView/Native
- 解析JSON-PRC 2.0数据报文，提供方法暴露、调用等接口

## 安装和使用

```bash
npm i jsonrpcv2
```

## 使用

### 服务端

```ts
import { WebSocketServer } from 'ws';
import { RPC } from 'jsonrpcv2';

const serverRPC = new RPC();

// 注册同步方法
serverRPC.expose('syncMethod', () => {
    return 'syncMethod.result';
});

// 注册异步方法
serverRPC.expose('asyncMethod', () => {
    return Promise.resolve('asyncMethod.result');
});

const wss = new WebSocketServer({
    port: 2188
});

wss.on('connection', (websocket) => {
    // rpc通过websocket发送消息
    serverRPC.setTransmitter((message) => {
        websocket.send(message);
    });
    // websocket接受到消息转发给rpc
    websocket.on('message', (message) => {
        serverRPC.receive(Buffer.from(message).toString());
    });
});
```

### WebView

```ts
import { RPC } from 'jsonrpcv2';

const clientRPC = new RPC();

// web的websocket原生对象
const ws = new WebSocket('localhost:2188');
ws.onopen = function () {
    // 调用服务端syncMethod方法
    clientRPC.call('syncMethod')
        .then((result) => {
            console.log(result); // syncMethod.result
        })
        .catch((error) => {
            // error
        });

    // 调用服务端 asyncMethod 方法
    clientRPC.call('asyncMethod')
        .then((result) => {
            console.log(result); // asyncMethod.result
        })
        .catch((error) => {
            // error
        })
}
```

## API

### rpc = new RPC()

```ts
import { RPC } from 'jsonrpcv2'
const rpc = new RPC();
```

### rpc.receive(*message*)

对端的RPC消息通过该方法通知到本地RPC

- `message` {`string`} JSON RPC报文

### rpc.setTransmitter(*transmitter*)

到对端的RPC消息从这里发出，消息如何放松到对端，取决于你的transmitter

- `transmitter` {`(message:string)=>Promise`} 发送通道

### rpc.expose(*methodName*, *method*)

暴露方法，供对端调用

- `methodName` {`string`} 暴露的方法名称
- `method` {`Function`} 方法实例
  > 根据[JSON-RPC 2.0](https://wiki.geekdream.com/Specification/json-rpc_2.0.html) 标准，暴露方法的参数支持索引和名称关联, jsonrpcv2目前暂时仅支持索引

### rpc.unexpose(*methodName*)

取消已暴露的方法

- `methodName` {`string`} 已暴露的方法名称

### rpc.call(*methodName*,*args*)

调用对端方法

- `methodName` {`string`} 方法名称
- `args` {`Array` | `Object`} 参数，索引（Array）或名称关联（Object）
- `return` {`Promise<Result>`}

### rpc.onNotification(*name*, *callback*)

添加通知监听

- `name` {`string`} 通知名称
- `callback` {`Function`} 通知回调

### rpc.removeNotification(*name*, *callback*)

删除通知监听

- `name` {`string`} 通知名称
- `callback` {`Function`} 通知回调

### rpc.notify(*name*,*args*)

通知对端

- `name` {`string`} 通知名称
- `args` {`Array` | `Object`} 参数，索引（Array）或名称关联（Object）



