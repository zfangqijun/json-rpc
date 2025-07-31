# TypeScript Types Documentation

## Overview

This document provides comprehensive documentation for all TypeScript types, interfaces, and type definitions exported by the `jsonrpcv2` library.

## Exported Types

### CallArgs

```typescript
export type CallArgs = RpcParams;
```

**Description:** Type alias for JSON-RPC parameters. This type represents the parameters that can be passed to RPC methods.

**Source:** Imported from `jsonrpc-lite` library

**Usage:**
```typescript
import { CallArgs } from 'jsonrpcv2';

// CallArgs can be:
const arrayParams: CallArgs = [1, 2, 3];
const objectParams: CallArgs = { name: 'John', age: 30 };
const primitiveParam: CallArgs = 'hello';
const nullParam: CallArgs = null;
```

### Result

```typescript
export type Result = string | number | boolean | object | null;
```

**Description:** Represents all possible return types from RPC methods.

**Possible Values:**
- `string` - Text values
- `number` - Numeric values (integers or floats)
- `boolean` - True or false values
- `object` - Complex objects, arrays, or any object type
- `null` - Null value (used when method returns undefined)

**Usage:**
```typescript
import { Result } from 'jsonrpcv2';

// Valid result types
const stringResult: Result = 'Hello World';
const numberResult: Result = 42;
const booleanResult: Result = true;
const objectResult: Result = { id: 1, name: 'John' };
const arrayResult: Result = [1, 2, 3, 4];
const nullResult: Result = null;
```

### RPCMethod

```typescript
export type RPCMethod = (...args: unknown[]) => Result | Promise<Result> | void;
```

**Description:** Type definition for functions that can be exposed as RPC methods.

**Parameters:**
- `...args: unknown[]` - Variable number of arguments of any type

**Return Types:**
- `Result` - Synchronous method returning a result
- `Promise<Result>` - Asynchronous method returning a promise
- `void` - Method with no return value (converted to null)

**Usage:**
```typescript
import { RPCMethod } from 'jsonrpcv2';

// Synchronous method
const syncMethod: RPCMethod = (a: number, b: number) => {
  return a + b;
};

// Asynchronous method
const asyncMethod: RPCMethod = async (userId: string) => {
  const user = await fetchUser(userId);
  return user;
};

// Method with no return value
const voidMethod: RPCMethod = (message: string) => {
  console.log(message);
  // Implicitly returns undefined, which becomes null
};

// Method with complex parameters
const complexMethod: RPCMethod = (
  config: { timeout: number; retries: number },
  callback?: (result: any) => void
) => {
  // Implementation
  return { success: true };
};
```

## Internal Types (From Dependencies)

These types are imported from the `jsonrpc-lite` library and used internally:

### RpcParams

```typescript
// From jsonrpc-lite
type RpcParams = any[] | object | string | number | boolean | null;
```

**Description:** Represents valid JSON-RPC parameter types according to the specification.

### Defined

```typescript
// From jsonrpc-lite
type Defined = string | number | boolean | object | null;
```

**Description:** Represents defined (non-undefined) values that can be used in JSON-RPC.

### IParsedObject

```typescript
// From jsonrpc-lite
interface IParsedObject {
  type: RpcStatusType;
  payload: RequestObject | SuccessObject | ErrorObject | NotificationObject | string;
}
```

**Description:** Represents a parsed JSON-RPC message with its type and payload.

### RpcStatusType

```typescript
// From jsonrpc-lite
enum RpcStatusType {
  request = 'request',
  success = 'success',
  error = 'error',
  notification = 'notification',
  invalid = 'invalid'
}
```

**Description:** Enumeration of possible JSON-RPC message types.

### RequestObject

```typescript
// From jsonrpc-lite
interface RequestObject {
  jsonrpc: '2.0';
  method: string;
  params?: RpcParams;
  id: string | number;
}
```

**Description:** Represents a JSON-RPC request message.

### SuccessObject

```typescript
// From jsonrpc-lite
interface SuccessObject {
  jsonrpc: '2.0';
  result: any;
  id: string | number;
}
```

**Description:** Represents a successful JSON-RPC response message.

### ErrorObject

```typescript
// From jsonrpc-lite
interface ErrorObject {
  jsonrpc: '2.0';
  error: {
    code: number;
    message: string;
    data?: any;
  };
  id: string | number | null;
}
```

**Description:** Represents a JSON-RPC error response message.

### NotificationObject

```typescript
// From jsonrpc-lite
interface NotificationObject {
  jsonrpc: '2.0';
  method: string;
  params?: RpcParams;
}
```

**Description:** Represents a JSON-RPC notification message (no response expected).

## Type Usage Examples

### Method Parameter Typing

```typescript
import { RPCMethod, Result } from 'jsonrpcv2';

// Strongly typed method interfaces
interface User {
  id: string;
  name: string;
  email: string;
}

interface CreateUserParams {
  name: string;
  email: string;
  role?: string;
}

// Type-safe method implementation
const createUser: RPCMethod = async (params: CreateUserParams): Promise<User> => {
  // TypeScript provides full type checking here
  const user: User = {
    id: generateId(),
    name: params.name,
    email: params.email
  };
  
  await saveUser(user);
  return user;
};

// Register with RPC
rpc.expose('user.create', createUser);
```

### Generic Result Handling

```typescript
import { Result } from 'jsonrpcv2';

// Generic wrapper for type-safe results
async function invokeTyped<T extends Result>(
  rpc: RPC, 
  method: string, 
  ...args: any[]
): Promise<T> {
  const result = await rpc.invoke(method, ...args);
  return result as T;
}

// Usage with type safety
interface UserData {
  id: string;
  name: string;
}

const userData = await invokeTyped<UserData>(rpc, 'user.get', '123');
// userData is now typed as UserData
console.log(userData.name); // TypeScript knows this property exists
```

### Custom Type Guards

```typescript
import { Result } from 'jsonrpcv2';

// Type guard functions
function isString(value: Result): value is string {
  return typeof value === 'string';
}

function isUserObject(value: Result): value is User {
  return typeof value === 'object' && 
         value !== null && 
         'id' in value && 
         'name' in value && 
         'email' in value;
}

// Usage with type guards
const result = await rpc.invoke('getUser', '123');

if (isUserObject(result)) {
  // TypeScript knows result is User type here
  console.log(result.name);
} else if (isString(result)) {
  // TypeScript knows result is string here
  console.log('Error:', result);
}
```

### Event Handler Typing

```typescript
// Type-safe notification handlers
interface SystemAlert {
  level: 'info' | 'warning' | 'error';
  message: string;
  timestamp: number;
}

interface UserAction {
  userId: string;
  action: string;
  metadata?: Record<string, any>;
}

// Strongly typed notification handlers
const handleSystemAlert = (alert: SystemAlert) => {
  console.log(`[${alert.level.toUpperCase()}] ${alert.message}`);
};

const handleUserAction = (action: UserAction) => {
  console.log(`User ${action.userId} performed: ${action.action}`);
};

// Register typed handlers
rpc.onNotification('system.alert', handleSystemAlert);
rpc.onNotification('user.action', handleUserAction);
```

### Transport Function Typing

```typescript
// Type for transport functions
type TransportFunction = (message: string) => Promise<unknown>;

// WebSocket transport
const wsTransport: TransportFunction = async (message: string) => {
  if (websocket.readyState === WebSocket.OPEN) {
    websocket.send(message);
  } else {
    throw new Error('WebSocket not connected');
  }
};

// HTTP transport
const httpTransport: TransportFunction = async (message: string) => {
  const response = await fetch('/rpc', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: message
  });
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  
  return response.json();
};

// Set transport with full type safety
rpc.setTransmitter(wsTransport);
```

## Advanced Type Patterns

### Method Registry Pattern

```typescript
// Define a registry of available methods with their types
interface MethodRegistry {
  'user.create': (params: CreateUserParams) => Promise<User>;
  'user.get': (id: string) => Promise<User | null>;
  'user.update': (id: string, updates: Partial<User>) => Promise<User>;
  'user.delete': (id: string) => Promise<boolean>;
  'math.add': (a: number, b: number) => number;
  'math.multiply': (a: number, b: number) => number;
}

// Type-safe RPC wrapper
class TypedRPC {
  constructor(private rpc: RPC) {}

  async invoke<K extends keyof MethodRegistry>(
    method: K,
    ...args: Parameters<MethodRegistry[K]>
  ): Promise<ReturnType<MethodRegistry[K]>> {
    return this.rpc.invoke(method, ...args);
  }

  expose<K extends keyof MethodRegistry>(
    method: K,
    implementation: MethodRegistry[K]
  ): void {
    this.rpc.expose(method, implementation as RPCMethod);
  }
}

// Usage with full type safety
const typedRPC = new TypedRPC(rpc);

// TypeScript enforces correct parameter types
const user = await typedRPC.invoke('user.create', { 
  name: 'John', 
  email: 'john@example.com' 
});

// TypeScript prevents incorrect usage
// await typedRPC.invoke('user.create', 'invalid'); // ❌ Type error
```

### Conditional Return Types

```typescript
// Conditional types for different method signatures
type MethodReturnType<T> = T extends (...args: any[]) => infer R 
  ? R extends Promise<infer U> 
    ? U 
    : R
  : never;

// Helper type for async methods
type AsyncMethod<T extends any[], R> = (...args: T) => Promise<R>;
type SyncMethod<T extends any[], R> = (...args: T) => R;

// Type-safe method definitions
const asyncMethods = {
  'user.create': (async (params: CreateUserParams): Promise<User> => {
    // Implementation
    return {} as User;
  }) as AsyncMethod<[CreateUserParams], User>,
  
  'user.fetch': (async (id: string): Promise<User | null> => {
    // Implementation
    return null;
  }) as AsyncMethod<[string], User | null>
};

const syncMethods = {
  'math.add': ((a: number, b: number): number => {
    return a + b;
  }) as SyncMethod<[number, number], number>
};
```

This comprehensive type documentation provides complete coverage of all TypeScript types used in the jsonrpcv2 library, along with practical examples and advanced patterns for type-safe usage.