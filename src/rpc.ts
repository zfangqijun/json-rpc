import {
    jsonrpc, RpcParams, Defined, IParsedObject, RpcStatusType, RequestObject, SuccessObject, ErrorObject, NotificationObject
} from 'jsonrpc-lite';
import { EventEmitter } from 'events';
import { v4 as uuid } from 'uuid'

export type CallArgs = RpcParams;

export type Result = string | number | boolean | object | null;

type ResponseCallback = (result: Result) => void;

export type RPCMethod = (...args: unknown[]) => Result | Promise<Result> | void;

class RPC extends EventEmitter {
    private exposeMethods: Map<string, RPCMethod> = new Map();

    private responseCallbackMap: Map<string, ResponseCallback> = new Map();

    private transmitter?: (message: string) => Promise<unknown>;

    constructor() {
        super();
        this.addListener('message', this.handleMessage);
    }

    public invoke(methodName: string, ...args: Defined[]) {
        return new Promise((resolve, reject) => {
            const id = uuid();
            const requestObject = jsonrpc.request(id, methodName, args);
            this.responseCallbackMap.set(id, resolve);
            this.send(requestObject.serialize()).catch((error) => {
                this.responseCallbackMap.delete(id)
                reject(error);
            })
        })
    }

    public notify(name: string, ...args: Defined[]) {
        const notificationObject = jsonrpc.notification(name, args);
        this.send(notificationObject.serialize());
    }

    public expose(methodName: string, method: RPCMethod) {
        if (this.exposeMethods.has(methodName)) {
            throw new Error(`method ${methodName} exposed\r\n${methodName}方法已暴露`)
        }
        if (typeof method !== 'function') {
            throw new Error(`method instance must be function\r\n方法实例必须为function`)
        }
        this.exposeMethods.set(methodName, method);
    }

    public exposeFromObject(object: object) {
        for (const [key, value] of Object.entries(object)) {
            if (typeof value === 'function') {
                this.expose(key, value);
            }
        }
    }

    public exposeFromArray(array: Array<[string, RPCMethod]>) {
        for (const [key, value] of array) {
            this.expose(key, value);
        }
    }

    public unexpose(methodName: string) {
        if (this.exposeMethods.has(methodName)) {
            this.exposeMethods.delete(methodName);
        } else {
            throw new Error(`Method ${methodName} not exist.` + `\r\nMethod ${methodName} 不存在。`)
        }
    }

    public unexposeAll() {
        this.exposeMethods.clear();
    }

    public onNotification(name: string, callback: (...args: any[]) => void) {
        this.addListener(`notification/${name}`, callback);
    }

    public removeNotification(name: string, callback: (...data: any[]) => void) {
        this.removeListener(`notification/${name}`, callback);
    }

    public receive(message: string) {
        this.emit('message', message);
    }

    public setTransmitter(transmitter: (message: string) => Promise<unknown>) {
        if (typeof transmitter !== 'function') {
            throw new Error('Transmitter must be function.' + '\r\nTransmitter 必须为 function。')
        }
        this.transmitter = transmitter;
    }

    private send = (message: string) => {
        if (!this.transmitter) return Promise.reject(new Error('Transmitter is nil'));
        return Promise.resolve(this.transmitter(message))
    }

    private handleMessage = (message: string) => {
        const parseObject = jsonrpc.parse(message);
        Array.from([parseObject]).flat().forEach(this.handleRPCMessage)
    }

    private handleRPCMessage = (message: IParsedObject) => {
        switch (message.type) {
            case RpcStatusType.request:
                this.handleRPCRequest(message.payload);
                break;
            case RpcStatusType.success:
                this.handleRPCSuccess(message.payload);
                break;
            case RpcStatusType.error:
                this.handleRPCError(message.payload);
                break;
            case RpcStatusType.notification:
                this.handleRPCNotification(message.payload);
                break;
            case RpcStatusType.invalid:
                this.emit('invalid', message.payload)
                break;
            default:
                break;
        }
    }

    private handleRPCRequest = (requestObject: RequestObject) => {
        const { method: methodName, id, params } = requestObject;
        const method = this.exposeMethods.get(methodName);

        if (method === undefined) {
            const errorObject = jsonrpc.error(id, jsonrpc.JsonRpcError.methodNotFound('该方法不存在或无效'))
            this.send(errorObject.serialize())
            return;
        }

        const methodCall = async (params: Defined[]) => {
            try {
                let result = await method(...params);
                if (result === undefined) {
                    result = null;
                }

                const successObject = jsonrpc.success(id, result)
                this.send(successObject.serialize())
            }
            catch (error) {
                const jsonRpcError = new jsonrpc.JsonRpcError('对端方法执行内部异常', 32000, Object.prototype.valueOf.call(error))
                const errorObject = jsonrpc.error(id, jsonRpcError)
                this.send(errorObject.serialize())
            }
        }

        if (Array.isArray(params)) {
            methodCall(params)
            return;
        }

        if (params === undefined) {
            methodCall([])
            return
        }

        if (params === null) {
            methodCall([null])
            return
        }

        if (typeof params === 'object') {
            methodCall([params])
            return
        }

        const errorObject = jsonrpc.error(id, jsonrpc.JsonRpcError.invalidParams('无效的方法参数'))
        this.send(errorObject.serialize())
    }

    private handleRPCSuccess = (successObject: SuccessObject) => {
        const { id, result } = successObject;
        const resolve = this.responseCallbackMap.get(id as string);
        if (resolve) {
            resolve(result)
        }
    }

    private handleRPCError = (errorObject: ErrorObject) => {
        const { id, error } = errorObject;
        const resolve = this.responseCallbackMap.get(id as string);
        if (resolve) {
            resolve(Promise.reject(error))
        }
    }

    private handleRPCNotification = (notificationObject: NotificationObject) => {
        const { method, params } = notificationObject;
        if (Object.prototype.hasOwnProperty.call(notificationObject, 'params')) {
            if (Array.isArray(params)) {
                this.emit(`notification/${method}`, ...params);
            } else {
                this.emit(`notification/${method}`, params);
            }
        } else {
            this.emit(`notification/${method}`);
        }
    }
}

export { RPC };
