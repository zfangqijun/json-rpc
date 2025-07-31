# Examples Documentation

## Table of Contents

- [Basic Examples](#basic-examples)
- [Transport Integrations](#transport-integrations)
- [Framework Integrations](#framework-integrations)
- [Advanced Patterns](#advanced-patterns)
- [Real-world Applications](#real-world-applications)
- [Testing Examples](#testing-examples)

## Basic Examples

### Simple Calculator Service

```typescript
import { RPC } from 'jsonrpcv2';

// Create RPC instances
const server = new RPC();
const client = new RPC();

// Server: Expose calculator methods
server.expose('add', (a: number, b: number) => a + b);
server.expose('subtract', (a: number, b: number) => a - b);
server.expose('multiply', (a: number, b: number) => a * b);
server.expose('divide', (a: number, b: number) => {
  if (b === 0) throw new Error('Division by zero');
  return a / b;
});

// Simple in-memory transport for demonstration
let serverTransmitter: (message: string) => Promise<void>;
let clientTransmitter: (message: string) => Promise<void>;

server.setTransmitter(async (message) => {
  // Simulate network delay
  setTimeout(() => client.receive(message), 10);
});

client.setTransmitter(async (message) => {
  setTimeout(() => server.receive(message), 10);
});

// Client: Use calculator
async function runCalculations() {
  try {
    const sum = await client.invoke('add', 10, 5);
    console.log('10 + 5 =', sum); // 15
    
    const product = await client.invoke('multiply', 3, 4);
    console.log('3 * 4 =', product); // 12
    
    const quotient = await client.invoke('divide', 15, 3);
    console.log('15 / 3 =', quotient); // 5
  } catch (error) {
    console.error('Calculation error:', error);
  }
}

runCalculations();
```

### Async Operations with Notifications

```typescript
import { RPC } from 'jsonrpcv2';

class FileProcessor {
  private rpc: RPC;
  private processingTasks = new Map<string, any>();

  constructor(rpc: RPC) {
    this.rpc = rpc;
    this.setupMethods();
  }

  private setupMethods() {
    // Expose async file processing method
    this.rpc.expose('processFile', async (fileName: string, options: any) => {
      const taskId = this.generateTaskId();
      this.processingTasks.set(taskId, { fileName, status: 'processing' });
      
      // Notify that processing started
      this.rpc.notify('fileProcessing.started', { taskId, fileName });
      
      try {
        // Simulate file processing
        await this.simulateProcessing(fileName, taskId);
        
        this.processingTasks.set(taskId, { fileName, status: 'completed' });
        this.rpc.notify('fileProcessing.completed', { taskId, fileName });
        
        return { taskId, status: 'completed', result: `Processed ${fileName}` };
      } catch (error) {
        this.processingTasks.set(taskId, { fileName, status: 'failed', error });
        this.rpc.notify('fileProcessing.failed', { taskId, fileName, error: error.message });
        throw error;
      }
    });

    // Expose method to get task status
    this.rpc.expose('getTaskStatus', (taskId: string) => {
      return this.processingTasks.get(taskId) || null;
    });

    // Expose method to list all tasks
    this.rpc.expose('listTasks', () => {
      return Array.from(this.processingTasks.entries()).map(([id, task]) => ({
        id,
        ...task
      }));
    });
  }

  private generateTaskId(): string {
    return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async simulateProcessing(fileName: string, taskId: string): Promise<void> {
    const steps = ['reading', 'analyzing', 'transforming', 'writing'];
    
    for (const step of steps) {
      this.rpc.notify('fileProcessing.progress', { 
        taskId, 
        fileName, 
        step, 
        progress: (steps.indexOf(step) + 1) / steps.length * 100 
      });
      
      // Simulate processing time
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
}

// Usage
const processor = new RPC();
const client = new RPC();

// Set up transport (WebSocket, etc.)
setupTransport(processor, client);

const fileProcessor = new FileProcessor(processor);

// Client side: Listen for notifications
client.onNotification('fileProcessing.started', (data) => {
  console.log(`File processing started: ${data.fileName} (Task: ${data.taskId})`);
});

client.onNotification('fileProcessing.progress', (data) => {
  console.log(`Progress: ${data.step} - ${data.progress}%`);
});

client.onNotification('fileProcessing.completed', (data) => {
  console.log(`File processing completed: ${data.fileName}`);
});

client.onNotification('fileProcessing.failed', (data) => {
  console.log(`File processing failed: ${data.fileName} - ${data.error}`);
});

// Start file processing
async function processFiles() {
  try {
    const result = await client.invoke('processFile', 'document.pdf', { format: 'optimized' });
    console.log('Final result:', result);
  } catch (error) {
    console.error('Processing failed:', error);
  }
}
```

## Transport Integrations

### WebSocket Transport

```typescript
import { WebSocketServer } from 'ws';
import { RPC } from 'jsonrpcv2';

// Server setup
class WebSocketRPCServer {
  private wss: WebSocketServer;
  private rpc: RPC;
  private clients = new Map<string, WebSocket>();

  constructor(port: number) {
    this.rpc = new RPC();
    this.wss = new WebSocketServer({ port });
    this.setupRPC();
    this.setupWebSocket();
  }

  private setupRPC() {
    // Expose server methods
    this.rpc.expose('server.getConnectedClients', () => {
      return Array.from(this.clients.keys());
    });

    this.rpc.expose('server.broadcastMessage', (message: string) => {
      this.broadcast('server.message', { message, timestamp: Date.now() });
      return { sent: true, clientCount: this.clients.size };
    });

    this.rpc.expose('echo', (message: any) => message);
  }

  private setupWebSocket() {
    this.wss.on('connection', (ws, request) => {
      const clientId = this.generateClientId();
      this.clients.set(clientId, ws);
      
      console.log(`Client ${clientId} connected from ${request.socket.remoteAddress}`);

      // Set transmitter for this connection
      this.rpc.setTransmitter((message) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(message);
        }
        return Promise.resolve();
      });

      // Handle incoming messages
      ws.on('message', (data) => {
        try {
          this.rpc.receive(data.toString());
        } catch (error) {
          console.error('Error processing RPC message:', error);
        }
      });

      // Handle disconnect
      ws.on('close', () => {
        this.clients.delete(clientId);
        console.log(`Client ${clientId} disconnected`);
      });

      // Notify client of successful connection
      this.rpc.notify('connection.established', { clientId });
    });
  }

  private broadcast(method: string, ...args: any[]) {
    const message = JSON.stringify({
      jsonrpc: '2.0',
      method,
      params: args
    });

    this.clients.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(message);
      }
    });
  }

  private generateClientId(): string {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Client setup
class WebSocketRPCClient {
  private ws: WebSocket;
  private rpc: RPC;
  private connected = false;

  constructor(url: string) {
    this.rpc = new RPC();
    this.ws = new WebSocket(url);
    this.setupWebSocket();
    this.setupRPC();
  }

  private setupWebSocket() {
    this.ws.onopen = () => {
      console.log('Connected to server');
      this.connected = true;
      
      this.rpc.setTransmitter((message) => {
        if (this.ws.readyState === WebSocket.OPEN) {
          this.ws.send(message);
          return Promise.resolve();
        }
        return Promise.reject(new Error('WebSocket not connected'));
      });
    };

    this.ws.onmessage = (event) => {
      try {
        this.rpc.receive(event.data);
      } catch (error) {
        console.error('Error processing RPC message:', error);
      }
    };

    this.ws.onclose = () => {
      console.log('Disconnected from server');
      this.connected = false;
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
  }

  private setupRPC() {
    // Listen for server notifications
    this.rpc.onNotification('connection.established', (data) => {
      console.log('Connection established, client ID:', data.clientId);
    });

    this.rpc.onNotification('server.message', (data) => {
      console.log('Server broadcast:', data.message);
    });

    // Expose client methods
    this.rpc.expose('client.ping', () => 'pong');
  }

  async invoke(method: string, ...args: any[]) {
    if (!this.connected) {
      throw new Error('Not connected to server');
    }
    return this.rpc.invoke(method, ...args);
  }

  notify(method: string, ...args: any[]) {
    if (this.connected) {
      this.rpc.notify(method, ...args);
    }
  }
}

// Usage
const server = new WebSocketRPCServer(8080);
const client = new WebSocketRPCClient('ws://localhost:8080');

// Wait for connection then test
setTimeout(async () => {
  try {
    const echo = await client.invoke('echo', 'Hello WebSocket RPC!');
    console.log('Echo response:', echo);

    const clients = await client.invoke('server.getConnectedClients');
    console.log('Connected clients:', clients);

    await client.invoke('server.broadcastMessage', 'Hello everyone!');
  } catch (error) {
    console.error('Error:', error);
  }
}, 1000);
```

### HTTP/Express Integration

```typescript
import express from 'express';
import { RPC } from 'jsonrpcv2';

class HTTPRPCServer {
  private app: express.Application;
  private rpc: RPC;

  constructor() {
    this.app = express();
    this.rpc = new RPC();
    this.setupExpress();
    this.setupRPC();
  }

  private setupExpress() {
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true }));

    // CORS middleware
    this.app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type');
      if (req.method === 'OPTIONS') {
        res.sendStatus(200);
      } else {
        next();
      }
    });

    // RPC endpoint
    this.app.post('/rpc', async (req, res) => {
      try {
        const response = await this.handleRPCRequest(JSON.stringify(req.body));
        res.json(response ? JSON.parse(response) : null);
      } catch (error) {
        console.error('RPC Error:', error);
        res.status(500).json({
          jsonrpc: '2.0',
          error: {
            code: -32603,
            message: 'Internal error',
            data: error.message
          },
          id: req.body.id || null
        });
      }
    });

    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.json({ status: 'healthy', timestamp: Date.now() });
    });
  }

  private setupRPC() {
    // Set up a capture mechanism for responses
    let capturedResponse: string | null = null;

    this.rpc.setTransmitter(async (message) => {
      capturedResponse = message;
      return Promise.resolve();
    });

    // Expose API methods
    this.rpc.expose('user.list', async () => {
      // Simulate database query
      return [
        { id: '1', name: 'John Doe', email: 'john@example.com' },
        { id: '2', name: 'Jane Smith', email: 'jane@example.com' }
      ];
    });

    this.rpc.expose('user.get', async (id: string) => {
      if (!id) throw new Error('User ID is required');
      
      // Simulate database lookup
      if (id === '1') {
        return { id: '1', name: 'John Doe', email: 'john@example.com' };
      }
      return null;
    });

    this.rpc.expose('user.create', async (userData: any) => {
      if (!userData.name || !userData.email) {
        throw new Error('Name and email are required');
      }

      // Simulate user creation
      const newUser = {
        id: Math.random().toString(36).substr(2, 9),
        ...userData,
        createdAt: new Date().toISOString()
      };

      return newUser;
    });

    this.rpc.expose('system.time', () => new Date().toISOString());
    this.rpc.expose('system.stats', () => ({
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      platform: process.platform
    }));
  }

  private async handleRPCRequest(requestMessage: string): Promise<string | null> {
    return new Promise((resolve) => {
      let responseMessage: string | null = null;

      // Temporarily override transmitter to capture response
      const originalTransmitter = this.rpc['transmitter'];
      
      this.rpc.setTransmitter(async (message) => {
        responseMessage = message;
        return Promise.resolve();
      });

      // Process the request
      this.rpc.receive(requestMessage);

      // Restore original transmitter
      if (originalTransmitter) {
        this.rpc['transmitter'] = originalTransmitter;
      }

      // Wait a bit for async operations, then resolve
      setTimeout(() => resolve(responseMessage), 10);
    });
  }

  listen(port: number) {
    this.app.listen(port, () => {
      console.log(`HTTP RPC Server listening on port ${port}`);
      console.log(`RPC endpoint: http://localhost:${port}/rpc`);
      console.log(`Health check: http://localhost:${port}/health`);
    });
  }
}

// HTTP Client helper
class HTTPRPCClient {
  constructor(private baseUrl: string) {}

  async invoke(method: string, ...params: any[]): Promise<any> {
    const request = {
      jsonrpc: '2.0',
      method,
      params,
      id: Math.random().toString(36).substr(2, 9)
    };

    const response = await fetch(`${this.baseUrl}/rpc`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(request)
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();

    if (result.error) {
      throw new Error(`RPC Error ${result.error.code}: ${result.error.message}`);
    }

    return result.result;
  }

  async notify(method: string, ...params: any[]): Promise<void> {
    const notification = {
      jsonrpc: '2.0',
      method,
      params
    };

    await fetch(`${this.baseUrl}/rpc`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(notification)
    });
  }
}

// Usage
const server = new HTTPRPCServer();
server.listen(3000);

// Client usage example
async function testHTTPRPC() {
  const client = new HTTPRPCClient('http://localhost:3000');

  try {
    // Test various methods
    const users = await client.invoke('user.list');
    console.log('Users:', users);

    const user = await client.invoke('user.get', '1');
    console.log('User 1:', user);

    const newUser = await client.invoke('user.create', {
      name: 'Alice Johnson',
      email: 'alice@example.com'
    });
    console.log('Created user:', newUser);

    const systemTime = await client.invoke('system.time');
    console.log('Server time:', systemTime);

    const stats = await client.invoke('system.stats');
    console.log('System stats:', stats);
  } catch (error) {
    console.error('Error:', error);
  }
}

// Wait for server to start, then test
setTimeout(testHTTPRPC, 1000);
```

### Socket.IO Integration

```typescript
import { Server as SocketIOServer } from 'socket.io';
import { io as SocketIOClient } from 'socket.io-client';
import { createServer } from 'http';
import { RPC } from 'jsonrpcv2';

// Server setup
class SocketIORPCServer {
  private io: SocketIOServer;
  private rpc: RPC;
  private connectedClients = new Map<string, any>();

  constructor(port: number) {
    const httpServer = createServer();
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"]
      }
    });
    
    this.rpc = new RPC();
    this.setupRPC();
    this.setupSocketIO();
    
    httpServer.listen(port, () => {
      console.log(`Socket.IO RPC Server listening on port ${port}`);
    });
  }

  private setupRPC() {
    // Expose room management methods
    this.rpc.expose('room.join', async (socketId: string, roomName: string) => {
      const socket = this.io.sockets.sockets.get(socketId);
      if (socket) {
        await socket.join(roomName);
        return { joined: true, room: roomName };
      }
      throw new Error('Socket not found');
    });

    this.rpc.expose('room.leave', async (socketId: string, roomName: string) => {
      const socket = this.io.sockets.sockets.get(socketId);
      if (socket) {
        await socket.leave(roomName);
        return { left: true, room: roomName };
      }
      throw new Error('Socket not found');
    });

    this.rpc.expose('room.broadcast', (roomName: string, message: any) => {
      this.io.to(roomName).emit('room_message', message);
      return { sent: true, room: roomName };
    });

    this.rpc.expose('server.getStats', () => ({
      connectedClients: this.connectedClients.size,
      rooms: Array.from(this.io.sockets.adapter.rooms.keys()),
      timestamp: Date.now()
    }));

    // Expose chat methods
    this.rpc.expose('chat.sendMessage', (from: string, to: string, message: string) => {
      const recipient = this.connectedClients.get(to);
      if (recipient) {
        recipient.socket.emit('private_message', { from, message, timestamp: Date.now() });
        return { sent: true, to };
      }
      return { sent: false, error: 'Recipient not found' };
    });
  }

  private setupSocketIO() {
    this.io.on('connection', (socket) => {
      console.log(`Client connected: ${socket.id}`);
      
      // Store client info
      this.connectedClients.set(socket.id, {
        socket,
        connectedAt: Date.now()
      });

      // Set up RPC for this connection
      this.rpc.setTransmitter((message) => {
        socket.emit('rpc_response', message);
        return Promise.resolve();
      });

      // Handle RPC requests
      socket.on('rpc_request', (message) => {
        this.rpc.receive(message);
      });

      // Handle disconnect
      socket.on('disconnect', () => {
        console.log(`Client disconnected: ${socket.id}`);
        this.connectedClients.delete(socket.id);
      });

      // Send welcome notification
      this.rpc.notify('connection.welcome', {
        socketId: socket.id,
        serverTime: Date.now()
      });
    });
  }
}

// Client setup
class SocketIORPCClient {
  private socket: any;
  private rpc: RPC;
  private connected = false;

  constructor(url: string) {
    this.rpc = new RPC();
    this.socket = SocketIOClient(url);
    this.setupSocketIO();
    this.setupRPC();
  }

  private setupSocketIO() {
    this.socket.on('connect', () => {
      console.log('Connected to server:', this.socket.id);
      this.connected = true;

      this.rpc.setTransmitter((message) => {
        this.socket.emit('rpc_request', message);
        return Promise.resolve();
      });
    });

    this.socket.on('rpc_response', (message: string) => {
      this.rpc.receive(message);
    });

    this.socket.on('disconnect', () => {
      console.log('Disconnected from server');
      this.connected = false;
    });

    this.socket.on('room_message', (message: any) => {
      console.log('Room message:', message);
    });

    this.socket.on('private_message', (message: any) => {
      console.log('Private message from', message.from, ':', message.message);
    });
  }

  private setupRPC() {
    this.rpc.onNotification('connection.welcome', (data) => {
      console.log('Welcome! Socket ID:', data.socketId);
    });

    // Expose client methods
    this.rpc.expose('client.ping', () => ({ pong: true, timestamp: Date.now() }));
  }

  async invoke(method: string, ...args: any[]) {
    if (!this.connected) {
      throw new Error('Not connected to server');
    }
    return this.rpc.invoke(method, ...args);
  }

  getSocketId(): string {
    return this.socket.id;
  }
}

// Usage example
const server = new SocketIORPCServer(3001);

// Create multiple clients to test
const client1 = new SocketIORPCClient('http://localhost:3001');
const client2 = new SocketIORPCClient('http://localhost:3001');

setTimeout(async () => {
  try {
    // Join a room
    await client1.invoke('room.join', client1.getSocketId(), 'general');
    await client2.invoke('room.join', client2.getSocketId(), 'general');

    // Broadcast to room
    await client1.invoke('room.broadcast', 'general', {
      type: 'announcement',
      text: 'Hello everyone in the general room!'
    });

    // Send private message
    await client1.invoke('chat.sendMessage', 
      client1.getSocketId(), 
      client2.getSocketId(), 
      'Hello client2!'
    );

    // Get server stats
    const stats = await client1.invoke('server.getStats');
    console.log('Server stats:', stats);
  } catch (error) {
    console.error('Error:', error);
  }
}, 2000);
```

## Framework Integrations

### Express.js API Server

```typescript
import express from 'express';
import { RPC } from 'jsonrpcv2';

interface User {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

interface CreateUserRequest {
  name: string;
  email: string;
}

class UserService {
  private users: Map<string, User> = new Map();

  async createUser(data: CreateUserRequest): Promise<User> {
    const id = Math.random().toString(36).substr(2, 9);
    const user: User = {
      id,
      name: data.name,
      email: data.email,
      createdAt: new Date().toISOString()
    };
    
    this.users.set(id, user);
    return user;
  }

  async getUserById(id: string): Promise<User | null> {
    return this.users.get(id) || null;
  }

  async listUsers(): Promise<User[]> {
    return Array.from(this.users.values());
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | null> {
    const user = this.users.get(id);
    if (!user) return null;

    const updatedUser = { ...user, ...updates };
    this.users.set(id, updatedUser);
    return updatedUser;
  }

  async deleteUser(id: string): Promise<boolean> {
    return this.users.delete(id);
  }
}

class ExpressRPCServer {
  private app: express.Application;
  private rpc: RPC;
  private userService: UserService;

  constructor() {
    this.app = express();
    this.rpc = new RPC();
    this.userService = new UserService();
    
    this.setupMiddleware();
    this.setupRPC();
    this.setupRoutes();
  }

  private setupMiddleware() {
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));
    
    // Logging middleware
    this.app.use((req, res, next) => {
      console.log(`${req.method} ${req.path} - ${new Date().toISOString()}`);
      next();
    });

    // Error handling middleware
    this.app.use((error: any, req: any, res: any, next: any) => {
      console.error('Express Error:', error);
      res.status(500).json({ error: 'Internal server error' });
    });
  }

  private setupRPC() {
    // User management methods
    this.rpc.expose('user.create', async (data: CreateUserRequest) => {
      if (!data.name || !data.email) {
        throw new Error('Name and email are required');
      }
      return this.userService.createUser(data);
    });

    this.rpc.expose('user.get', async (id: string) => {
      if (!id) throw new Error('User ID is required');
      return this.userService.getUserById(id);
    });

    this.rpc.expose('user.list', async () => {
      return this.userService.listUsers();
    });

    this.rpc.expose('user.update', async (id: string, updates: Partial<User>) => {
      if (!id) throw new Error('User ID is required');
      return this.userService.updateUser(id, updates);
    });

    this.rpc.expose('user.delete', async (id: string) => {
      if (!id) throw new Error('User ID is required');
      return this.userService.deleteUser(id);
    });

    // System methods
    this.rpc.expose('system.health', () => ({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage()
    }));

    this.rpc.expose('system.info', () => ({
      node: process.version,
      platform: process.platform,
      arch: process.arch,
      env: process.env.NODE_ENV || 'development'
    }));
  }

  private setupRoutes() {
    // RPC endpoint
    this.app.post('/api/rpc', async (req, res) => {
      try {
        const response = await this.handleRPCRequest(JSON.stringify(req.body));
        res.json(response ? JSON.parse(response) : null);
      } catch (error) {
        console.error('RPC Error:', error);
        res.status(500).json({
          jsonrpc: '2.0',
          error: {
            code: -32603,
            message: 'Internal error'
          },
          id: req.body.id || null
        });
      }
    });

    // REST endpoints for non-RPC clients
    this.app.get('/api/users', async (req, res) => {
      try {
        const users = await this.userService.listUsers();
        res.json(users);
      } catch (error) {
        res.status(500).json({ error: 'Failed to fetch users' });
      }
    });

    this.app.get('/api/users/:id', async (req, res) => {
      try {
        const user = await this.userService.getUserById(req.params.id);
        if (user) {
          res.json(user);
        } else {
          res.status(404).json({ error: 'User not found' });
        }
      } catch (error) {
        res.status(500).json({ error: 'Failed to fetch user' });
      }
    });

    this.app.post('/api/users', async (req, res) => {
      try {
        const user = await this.userService.createUser(req.body);
        res.status(201).json(user);
      } catch (error) {
        res.status(400).json({ error: error.message });
      }
    });

    // Health check
    this.app.get('/health', (req, res) => {
      res.json({ status: 'healthy', timestamp: new Date().toISOString() });
    });

    // API documentation
    this.app.get('/api/docs', (req, res) => {
      res.json({
        endpoints: {
          rpc: '/api/rpc',
          rest: {
            'GET /api/users': 'List all users',
            'GET /api/users/:id': 'Get user by ID',
            'POST /api/users': 'Create new user'
          }
        },
        rpcMethods: [
          'user.create',
          'user.get',
          'user.list', 
          'user.update',
          'user.delete',
          'system.health',
          'system.info'
        ]
      });
    });
  }

  private async handleRPCRequest(requestMessage: string): Promise<string | null> {
    return new Promise((resolve) => {
      let responseMessage: string | null = null;

      const originalTransmitter = this.rpc['transmitter'];
      
      this.rpc.setTransmitter(async (message) => {
        responseMessage = message;
        return Promise.resolve();
      });

      this.rpc.receive(requestMessage);

      if (originalTransmitter) {
        this.rpc['transmitter'] = originalTransmitter;
      }

      setTimeout(() => resolve(responseMessage), 10);
    });
  }

  listen(port: number) {
    this.app.listen(port, () => {
      console.log(`Express RPC Server listening on port ${port}`);
      console.log(`RPC endpoint: http://localhost:${port}/api/rpc`);
      console.log(`REST API: http://localhost:${port}/api/users`);
      console.log(`Docs: http://localhost:${port}/api/docs`);
    });
  }
}

// Usage
const server = new ExpressRPCServer();
server.listen(3000);
```

### Next.js API Integration

```typescript
// pages/api/rpc.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { RPC } from 'jsonrpcv2';

// Initialize RPC instance
const rpc = new RPC();

// Mock database
const database = {
  users: new Map<string, any>(),
  posts: new Map<string, any>()
};

// Expose Next.js specific methods
rpc.expose('auth.getSession', async (req: any) => {
  // Integration with NextAuth or similar
  return {
    user: { id: '1', name: 'John Doe' },
    authenticated: true
  };
});

rpc.expose('user.getProfile', async (userId: string) => {
  return database.users.get(userId) || null;
});

rpc.expose('post.create', async (postData: any, userId: string) => {
  const post = {
    id: Math.random().toString(36).substr(2, 9),
    ...postData,
    authorId: userId,
    createdAt: new Date().toISOString()
  };
  
  database.posts.set(post.id, post);
  return post;
});

rpc.expose('post.list', async (page: number = 1, limit: number = 10) => {
  const posts = Array.from(database.posts.values());
  const start = (page - 1) * limit;
  const end = start + limit;
  
  return {
    posts: posts.slice(start, end),
    pagination: {
      page,
      limit,
      total: posts.length,
      hasMore: end < posts.length
    }
  };
});

// Setup transmitter for capturing responses
let responseCapture: string | null = null;
rpc.setTransmitter(async (message) => {
  responseCapture = message;
  return Promise.resolve();
});

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    responseCapture = null;
    rpc.receive(JSON.stringify(req.body));
    
    // Wait for response capture
    await new Promise(resolve => setTimeout(resolve, 10));
    
    if (responseCapture) {
      const response = JSON.parse(responseCapture);
      res.status(200).json(response);
    } else {
      res.status(200).json(null);
    }
  } catch (error) {
    console.error('RPC Error:', error);
    res.status(500).json({
      jsonrpc: '2.0',
      error: {
        code: -32603,
        message: 'Internal error'
      },
      id: req.body?.id || null
    });
  }
}

// Client-side helper for Next.js
// utils/rpc-client.ts
export class NextRPCClient {
  private baseUrl: string;

  constructor(baseUrl = '/api/rpc') {
    this.baseUrl = baseUrl;
  }

  async invoke(method: string, ...params: any[]): Promise<any> {
    const request = {
      jsonrpc: '2.0',
      method,
      params,
      id: Math.random().toString(36).substr(2, 9)
    };

    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(request)
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();

    if (result.error) {
      throw new Error(`RPC Error ${result.error.code}: ${result.error.message}`);
    }

    return result.result;
  }
}

// Usage in React components
// components/UserProfile.tsx
import { useEffect, useState } from 'react';
import { NextRPCClient } from '../utils/rpc-client';

const rpcClient = new NextRPCClient();

export default function UserProfile({ userId }: { userId: string }) {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadProfile() {
      try {
        setLoading(true);
        const userProfile = await rpcClient.invoke('user.getProfile', userId);
        setProfile(userProfile);
      } catch (error) {
        console.error('Failed to load profile:', error);
      } finally {
        setLoading(false);
      }
    }

    loadProfile();
  }, [userId]);

  if (loading) return <div>Loading...</div>;
  if (!profile) return <div>Profile not found</div>;

  return (
    <div>
      <h1>{profile.name}</h1>
      <p>{profile.email}</p>
    </div>
  );
}
```

This comprehensive examples documentation provides practical implementations across various scenarios, transport layers, and framework integrations, demonstrating the flexibility and power of the jsonrpcv2 library.