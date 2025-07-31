# JSON-RPC 2.0 Library API Documentation

## Table of Contents

- [Overview](#overview)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [API Reference](#api-reference)
  - [RPC Class](#rpc-class)
  - [Types](#types)
  - [Public Methods](#public-methods)
  - [Events](#events)
- [Examples](#examples)
- [Error Handling](#error-handling)
- [Best Practices](#best-practices)

## Overview

The `jsonrpcv2` library provides a complete implementation of the JSON-RPC 2.0 specification for JavaScript/TypeScript. It supports bidirectional communication where both endpoints can act as client and server, sending requests and notifications to each other.

### Key Features

- **Bidirectional Communication**: Both endpoints can send requests and notifications
- **Pluggable Transport Layer**: Works with WebSockets, IPC, or any custom transport
- **TypeScript Support**: Full type definitions included
- **Promise-based API**: Modern async/await support
- **Event-driven Architecture**: Built on Node.js EventEmitter
- **Flexible Method Registration**: Multiple ways to expose methods

## Installation

```bash
npm install jsonrpcv2
```

```bash
yarn add jsonrpcv2
```

```bash
pnpm add jsonrpcv2
```

## Quick Start

### Basic Server Example

```typescript
import { WebSocketServer } from 'ws';
import { RPC } from 'jsonrpcv2';

const serverRPC = new RPC();

// Register methods
serverRPC.expose('add', (a: number, b: number) => a + b);
serverRPC.expose('greet', async (name: string) => `Hello, ${name}!`);

const wss = new WebSocketServer({ port: 8080 });

wss.on('connection', (ws) => {
  // Set up transport
  serverRPC.setTransmitter((message) => {
    ws.send(message);
    return Promise.resolve();
  });
  
  // Forward messages to RPC
  ws.on('message', (data) => {
    serverRPC.receive(data.toString());
  });
});
```

### Basic Client Example

```typescript
import { RPC } from 'jsonrpcv2';

const clientRPC = new RPC();
const ws = new WebSocket('ws://localhost:8080');

ws.onopen = () => {
  // Set up transport
  clientRPC.setTransmitter((message) => {
    ws.send(message);
    return Promise.resolve();
  });
  
  // Call remote methods
  clientRPC.invoke('add', 5, 3)
    .then(result => console.log('5 + 3 =', result)) // 8
    .catch(error => console.error('Error:', error));
};

ws.onmessage = (event) => {
  clientRPC.receive(event.data);
};
```

## API Reference

### RPC Class

The main RPC class that handles JSON-RPC 2.0 communication.

```typescript
class RPC extends EventEmitter
```

#### Constructor

```typescript
constructor()
```

Creates a new RPC instance.

**Example:**
```typescript
import { RPC } from 'jsonrpcv2';
const rpc = new RPC();
```

### Types

#### CallArgs
```typescript
type CallArgs = RpcParams;
```
Type alias for RPC parameters. Can be an array, object, or primitive values.

#### Result
```typescript
type Result = string | number | boolean | object | null;
```
Represents the possible return types from RPC methods.

#### RPCMethod
```typescript
type RPCMethod = (...args: unknown[]) => Result | Promise<Result> | void;
```
Type definition for methods that can be exposed via RPC.

### Public Methods

#### setTransmitter(transmitter)

Sets the transport mechanism for sending messages to the remote endpoint.

**Parameters:**
- `transmitter` `(message: string) => Promise<unknown>` - Function that handles message transmission

**Throws:** 
- `Error` if transmitter is not a function

**Example:**
```typescript
// WebSocket transport
rpc.setTransmitter((message) => {
  websocket.send(message);
  return Promise.resolve();
});

// Custom HTTP transport
rpc.setTransmitter(async (message) => {
  const response = await fetch('/rpc', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: message
  });
  return response.json();
});
```

#### receive(message)

Processes incoming JSON-RPC messages from the remote endpoint.

**Parameters:**
- `message` `string` - JSON-RPC message string

**Example:**
```typescript
websocket.on('message', (data) => {
  rpc.receive(data.toString());
});

// HTTP endpoint
app.post('/rpc', (req, res) => {
  const response = rpc.receive(JSON.stringify(req.body));
  res.json(response);
});
```

#### expose(methodName, method)

Registers a method to be callable by remote endpoints.

**Parameters:**
- `methodName` `string` - Name of the method to expose
- `method` `RPCMethod` - Function to execute when method is called

**Throws:**
- `Error` if method name is already exposed
- `Error` if method is not a function

**Example:**
```typescript
// Synchronous method
rpc.expose('add', (a: number, b: number) => {
  return a + b;
});

// Asynchronous method
rpc.expose('fetchUser', async (userId: string) => {
  const user = await database.findUser(userId);
  return user;
});

// Method with no return value
rpc.expose('log', (message: string) => {
  console.log(`[LOG] ${message}`);
  // Implicitly returns null
});

// Method with error handling
rpc.expose('divide', (a: number, b: number) => {
  if (b === 0) {
    throw new Error('Division by zero');
  }
  return a / b;
});
```

#### exposeFromObject(object)

Exposes all function properties from an object as RPC methods.

**Parameters:**
- `object` `object` - Object containing methods to expose

**Example:**
```typescript
const api = {
  add: (a: number, b: number) => a + b,
  subtract: (a: number, b: number) => a - b,
  multiply: (a: number, b: number) => a * b,
  notAFunction: "This won't be exposed"
};

rpc.exposeFromObject(api);
// Now 'add', 'subtract', and 'multiply' are available as RPC methods
```

#### exposeFromArray(array)

Exposes methods from an array of [name, method] tuples.

**Parameters:**
- `array` `Array<[string, RPCMethod]>` - Array of method name and function pairs

**Example:**
```typescript
const methods: Array<[string, RPCMethod]> = [
  ['math.add', (a: number, b: number) => a + b],
  ['math.subtract', (a: number, b: number) => a - b],
  ['string.upper', (str: string) => str.toUpperCase()],
  ['string.lower', (str: string) => str.toLowerCase()]
];

rpc.exposeFromArray(methods);
```

#### unexpose(methodName)

Removes a previously exposed method.

**Parameters:**
- `methodName` `string` - Name of the method to remove

**Throws:**
- `Error` if method doesn't exist

**Example:**
```typescript
rpc.expose('temporaryMethod', () => 'temp');
rpc.unexpose('temporaryMethod'); // Method no longer callable
```

#### unexposeAll()

Removes all exposed methods.

**Example:**
```typescript
rpc.expose('method1', () => 'result1');
rpc.expose('method2', () => 'result2');
rpc.unexposeAll(); // All methods removed
```

#### invoke(methodName, ...args)

Calls a method on the remote endpoint.

**Parameters:**
- `methodName` `string` - Name of the remote method to call
- `...args` `Defined[]` - Arguments to pass to the remote method

**Returns:** `Promise<Result>` - Promise that resolves with the method result

**Example:**
```typescript
// No arguments
const result1 = await rpc.invoke('getCurrentTime');

// With arguments
const result2 = await rpc.invoke('add', 10, 5);

// With complex arguments
const user = await rpc.invoke('createUser', {
  name: 'John Doe',
  email: 'john@example.com',
  roles: ['user', 'admin']
});

// Error handling
try {
  const result = await rpc.invoke('riskyMethod', 'param');
  console.log('Success:', result);
} catch (error) {
  console.error('RPC Error:', error);
}
```

#### notify(name, ...args)

Sends a notification to the remote endpoint (no response expected).

**Parameters:**
- `name` `string` - Name of the notification
- `...args` `Defined[]` - Arguments to send with the notification

**Example:**
```typescript
// Simple notification
rpc.notify('userLoggedIn', userId);

// Notification with multiple arguments
rpc.notify('fileUploaded', fileName, fileSize, uploadTime);

// Notification with object data
rpc.notify('systemEvent', {
  type: 'warning',
  message: 'High memory usage detected',
  timestamp: Date.now()
});
```

#### onNotification(name, callback)

Registers a listener for incoming notifications.

**Parameters:**
- `name` `string` - Name of the notification to listen for
- `callback` `(...args: any[]) => void` - Function to call when notification is received

**Example:**
```typescript
// Listen for simple notifications
rpc.onNotification('ping', () => {
  console.log('Received ping from remote');
});

// Listen for notifications with data
rpc.onNotification('userAction', (action: string, userId: string) => {
  console.log(`User ${userId} performed action: ${action}`);
});

// Listen for complex notifications
rpc.onNotification('systemAlert', (alert: {
  level: 'info' | 'warning' | 'error';
  message: string;
  timestamp: number;
}) => {
  console.log(`[${alert.level.toUpperCase()}] ${alert.message}`);
});
```

#### removeNotification(name, callback)

Removes a notification listener.

**Parameters:**
- `name` `string` - Name of the notification
- `callback` `(...args: any[]) => void` - The same callback function that was registered

**Example:**
```typescript
const handler = (data: any) => {
  console.log('Notification received:', data);
};

rpc.onNotification('test', handler);
// Later...
rpc.removeNotification('test', handler);
```

### Events

The RPC class extends EventEmitter and emits the following events:

#### 'invalid'

Emitted when an invalid JSON-RPC message is received.

**Example:**
```typescript
rpc.on('invalid', (payload) => {
  console.error('Invalid JSON-RPC message received:', payload);
});
```

#### 'notification/{name}'

Internal event used for handling notifications. Use `onNotification()` instead.

## Examples

### Complete WebSocket Server

```typescript
import { WebSocketServer } from 'ws';
import { RPC } from 'jsonrpcv2';

class CalculatorService {
  private history: Array<{ operation: string; result: number }> = [];

  add(a: number, b: number): number {
    const result = a + b;
    this.history.push({ operation: `${a} + ${b}`, result });
    return result;
  }

  async complexCalculation(numbers: number[]): Promise<number> {
    // Simulate async operation
    await new Promise(resolve => setTimeout(resolve, 100));
    return numbers.reduce((sum, num) => sum + num, 0);
  }

  getHistory(): Array<{ operation: string; result: number }> {
    return [...this.history];
  }

  clearHistory(): void {
    this.history = [];
  }
}

const server = new RPC();
const calculator = new CalculatorService();

// Expose individual methods
server.expose('add', calculator.add.bind(calculator));
server.expose('complexCalculation', calculator.complexCalculation.bind(calculator));
server.expose('getHistory', calculator.getHistory.bind(calculator));
server.expose('clearHistory', calculator.clearHistory.bind(calculator));

// Listen for notifications
server.onNotification('clientConnected', (clientId: string) => {
  console.log(`Client ${clientId} connected`);
});

const wss = new WebSocketServer({ port: 8080 });

wss.on('connection', (ws) => {
  console.log('New WebSocket connection');
  
  server.setTransmitter((message) => {
    ws.send(message);
    return Promise.resolve();
  });
  
  ws.on('message', (data) => {
    server.receive(data.toString());
  });
  
  ws.on('close', () => {
    console.log('WebSocket connection closed');
  });
});

console.log('Calculator RPC server listening on port 8080');
```

### Complete WebSocket Client

```typescript
import { RPC } from 'jsonrpcv2';

class CalculatorClient {
  private rpc: RPC;
  private ws: WebSocket;

  constructor(url: string) {
    this.rpc = new RPC();
    this.ws = new WebSocket(url);
    this.setupConnection();
  }

  private setupConnection(): void {
    this.ws.onopen = () => {
      console.log('Connected to calculator server');
      
      this.rpc.setTransmitter((message) => {
        this.ws.send(message);
        return Promise.resolve();
      });
      
      // Notify server of connection
      this.rpc.notify('clientConnected', 'client-123');
    };
    
    this.ws.onmessage = (event) => {
      this.rpc.receive(event.data);
    };
    
    this.ws.onclose = () => {
      console.log('Disconnected from server');
    };
  }

  async add(a: number, b: number): Promise<number> {
    return this.rpc.invoke('add', a, b);
  }

  async calculateSum(numbers: number[]): Promise<number> {
    return this.rpc.invoke('complexCalculation', numbers);
  }

  async getHistory(): Promise<Array<{ operation: string; result: number }>> {
    return this.rpc.invoke('getHistory');
  }

  async clearHistory(): Promise<void> {
    return this.rpc.invoke('clearHistory');
  }
}

// Usage
const client = new CalculatorClient('ws://localhost:8080');

// Wait for connection then perform operations
setTimeout(async () => {
  try {
    const result1 = await client.add(10, 5);
    console.log('10 + 5 =', result1);
    
    const result2 = await client.calculateSum([1, 2, 3, 4, 5]);
    console.log('Sum of [1,2,3,4,5] =', result2);
    
    const history = await client.getHistory();
    console.log('Calculation history:', history);
  } catch (error) {
    console.error('Error:', error);
  }
}, 1000);
```

### HTTP Transport Example

```typescript
import express from 'express';
import { RPC } from 'jsonrpcv2';

const app = express();
app.use(express.json());

const rpc = new RPC();

// Expose methods
rpc.expose('echo', (message: string) => message);
rpc.expose('timestamp', () => new Date().toISOString());

// HTTP transport implementation
rpc.setTransmitter(async (message) => {
  // For HTTP, we don't actively send messages
  // Responses are handled by the HTTP response
  return Promise.resolve();
});

app.post('/rpc', (req, res) => {
  const requestMessage = JSON.stringify(req.body);
  
  // Process the RPC request
  rpc.receive(requestMessage);
  
  // Capture response (this is simplified - you'd need more sophisticated handling)
  // In practice, you'd modify the RPC class or use a different pattern for HTTP
  res.json({ result: 'processed' });
});

app.listen(3000, () => {
  console.log('HTTP RPC server listening on port 3000');
});
```

### Electron IPC Example

```typescript
// Main process
import { ipcMain } from 'electron';
import { RPC } from 'jsonrpcv2';

const mainRPC = new RPC();

mainRPC.expose('getSystemInfo', () => {
  return {
    platform: process.platform,
    arch: process.arch,
    version: process.version
  };
});

mainRPC.setTransmitter((message) => {
  webContents.send('rpc-message', message);
  return Promise.resolve();
});

ipcMain.on('rpc-message', (event, message) => {
  mainRPC.receive(message);
});

// Renderer process
import { ipcRenderer } from 'electron';
import { RPC } from 'jsonrpcv2';

const rendererRPC = new RPC();

rendererRPC.setTransmitter((message) => {
  ipcRenderer.send('rpc-message', message);
  return Promise.resolve();
});

ipcRenderer.on('rpc-message', (event, message) => {
  rendererRPC.receive(message);
});

// Usage in renderer
rendererRPC.invoke('getSystemInfo').then(info => {
  console.log('System info:', info);
});
```

## Error Handling

### Common Error Scenarios

#### Method Not Found
```typescript
try {
  await rpc.invoke('nonexistentMethod');
} catch (error) {
  // error.code === -32601
  // error.message === "Method not found"
}
```

#### Invalid Parameters
```typescript
try {
  await rpc.invoke('methodExpectingString', 123);
} catch (error) {
  // error.code === -32602
  // error.message === "Invalid params"
}
```

#### Internal Error
```typescript
rpc.expose('faultyMethod', () => {
  throw new Error('Something went wrong');
});

// When called remotely:
try {
  await remoteRPC.invoke('faultyMethod');
} catch (error) {
  // error.code === 32000
  // error.message === "对端方法执行内部异常"
  // error.data contains the original error
}
```

#### Transport Errors
```typescript
try {
  await rpc.invoke('someMethod');
} catch (error) {
  if (error.message === 'Transmitter is nil') {
    console.error('No transport configured');
  }
}
```

### Error Handling Best Practices

```typescript
class RobustRPCClient {
  private rpc: RPC;
  private connectionState: 'connected' | 'connecting' | 'disconnected' = 'disconnected';

  async safeInvoke<T>(method: string, ...args: any[]): Promise<T | null> {
    if (this.connectionState !== 'connected') {
      console.warn('RPC not connected, operation skipped');
      return null;
    }

    try {
      return await this.rpc.invoke(method, ...args);
    } catch (error: any) {
      if (error.code === -32601) {
        console.error(`Method '${method}' not found on remote`);
      } else if (error.code === -32602) {
        console.error(`Invalid parameters for method '${method}'`);
      } else {
        console.error(`RPC error in '${method}':`, error);
      }
      return null;
    }
  }

  async invokeWithRetry<T>(method: string, maxRetries: number = 3, ...args: any[]): Promise<T> {
    let lastError: any;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await this.rpc.invoke(method, ...args);
      } catch (error: any) {
        lastError = error;
        if (attempt < maxRetries) {
          console.warn(`Attempt ${attempt} failed, retrying...`);
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }
      }
    }
    
    throw lastError;
  }
}
```

## Best Practices

### 1. Method Naming Conventions

```typescript
// Use namespace-like naming for organization
rpc.expose('user.create', createUser);
rpc.expose('user.update', updateUser);
rpc.expose('user.delete', deleteUser);
rpc.expose('file.upload', uploadFile);
rpc.expose('file.download', downloadFile);
```

### 2. Type Safety

```typescript
// Define interfaces for better type safety
interface User {
  id: string;
  name: string;
  email: string;
}

interface CreateUserParams {
  name: string;
  email: string;
}

// Typed method exposure
rpc.expose('user.create', async (params: CreateUserParams): Promise<User> => {
  // Implementation with full type safety
  return await userService.create(params);
});

// Typed method invocation
const newUser = await rpc.invoke('user.create', {
  name: 'John Doe',
  email: 'john@example.com'
}) as User;
```

### 3. Connection Management

```typescript
class ManagedRPC {
  private rpc: RPC;
  private connection: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  constructor(private url: string) {
    this.rpc = new RPC();
    this.connect();
  }

  private connect(): void {
    this.connection = new WebSocket(this.url);
    
    this.connection.onopen = () => {
      console.log('RPC connected');
      this.reconnectAttempts = 0;
      this.setupRPC();
    };
    
    this.connection.onclose = () => {
      console.log('RPC disconnected');
      this.scheduleReconnect();
    };
    
    this.connection.onerror = (error) => {
      console.error('RPC connection error:', error);
    };
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
      console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
      setTimeout(() => this.connect(), delay);
    }
  }

  private setupRPC(): void {
    this.rpc.setTransmitter((message) => {
      if (this.connection?.readyState === WebSocket.OPEN) {
        this.connection.send(message);
        return Promise.resolve();
      }
      return Promise.reject(new Error('Connection not open'));
    });
    
    this.connection!.onmessage = (event) => {
      this.rpc.receive(event.data);
    };
  }

  // Proxy methods to underlying RPC
  invoke(method: string, ...args: any[]): Promise<any> {
    return this.rpc.invoke(method, ...args);
  }

  expose(method: string, handler: (...args: any[]) => any): void {
    this.rpc.expose(method, handler);
  }

  notify(name: string, ...args: any[]): void {
    this.rpc.notify(name, ...args);
  }

  onNotification(name: string, callback: (...args: any[]) => void): void {
    this.rpc.onNotification(name, callback);
  }
}
```

### 4. Resource Cleanup

```typescript
class RPCManager {
  private rpc: RPC;
  private timers: Set<NodeJS.Timeout> = new Set();
  private listeners: Array<{ event: string; listener: Function }> = [];

  constructor() {
    this.rpc = new RPC();
  }

  addNotificationListener(name: string, callback: Function): void {
    this.rpc.onNotification(name, callback);
    this.listeners.push({ event: name, listener: callback });
  }

  setTimeout(callback: Function, delay: number): NodeJS.Timeout {
    const timer = setTimeout(callback, delay);
    this.timers.add(timer);
    return timer;
  }

  cleanup(): void {
    // Clear all timers
    this.timers.forEach(timer => clearTimeout(timer));
    this.timers.clear();

    // Remove all listeners
    this.listeners.forEach(({ event, listener }) => {
      this.rpc.removeNotification(event, listener);
    });
    this.listeners = [];

    // Clear all exposed methods
    this.rpc.unexposeAll();
  }
}
```

### 5. Logging and Debugging

```typescript
class LoggingRPC extends RPC {
  constructor(private logger: Console = console) {
    super();
    this.setupLogging();
  }

  private setupLogging(): void {
    // Log all outgoing invocations
    const originalInvoke = this.invoke.bind(this);
    this.invoke = async (method: string, ...args: any[]) => {
      this.logger.debug(`[RPC OUT] Invoking ${method} with args:`, args);
      try {
        const result = await originalInvoke(method, ...args);
        this.logger.debug(`[RPC OUT] ${method} result:`, result);
        return result;
      } catch (error) {
        this.logger.error(`[RPC OUT] ${method} error:`, error);
        throw error;
      }
    };

    // Log all outgoing notifications
    const originalNotify = this.notify.bind(this);
    this.notify = (name: string, ...args: any[]) => {
      this.logger.debug(`[RPC OUT] Notification ${name} with args:`, args);
      return originalNotify(name, ...args);
    };

    // Log incoming messages
    const originalReceive = this.receive.bind(this);
    this.receive = (message: string) => {
      this.logger.debug(`[RPC IN] Received message:`, message);
      return originalReceive(message);
    };
  }
}
```

This comprehensive documentation covers all public APIs, provides extensive examples, and includes best practices for using the JSON-RPC 2.0 library effectively in various scenarios.