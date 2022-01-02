import { EventEmitter } from 'events';

interface ITransport extends EventEmitter {
    send(message: string): void | Promise<void>;
}

export { ITransport };