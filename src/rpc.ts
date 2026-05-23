import {
    jsonrpc, RpcParams, Defined, IParsedObject, RpcStatusType, RequestObject, SuccessObject, ErrorObject, NotificationObject
} from 'jsonrpc-lite';
import { EventEmitter } from 'events';
import { v4 as uuid } from 'uuid'

export type InvokeArgs = RpcParams;

export type JSONPrimitive = string | number | boolean | null;

export type JSONValue = JSONPrimitive | JSONObject | JSONArray;

export interface JSONObject {
    [key: string]: JSONValue;
}

export type JSONArray = JSONValue[];

export type Result = JSONValue;

export type Transport = (message: string) => unknown | Promise<unknown>;

export type Transmitter = Transport;

type ResponseCallback = {
    resolve: (result: Result) => void;
    reject: (error: unknown) => void;
};

export type RpcHandler = (...args: unknown[]) => Result | Promise<Result> | void;

export type RPCMethod = RpcHandler;

type RpcErrorLike = {
    message: string;
    code: number;
    data?: unknown;
};

const isRpcErrorLike = (error: unknown): error is RpcErrorLike => {
    if (error instanceof jsonrpc.JsonRpcError) {
        return true;
    }

    if (typeof error !== 'object' || error === null) {
        return false;
    }

    const maybeError = error as Partial<RpcErrorLike>;
    return typeof maybeError.message === 'string' && Number.isInteger(maybeError.code);
}

const toRpcError = (error: unknown) => {
    if (error instanceof jsonrpc.JsonRpcError) {
        return error;
    }

    if (isRpcErrorLike(error)) {
        return new jsonrpc.JsonRpcError(error.message, error.code, error.data);
    }

    return new jsonrpc.JsonRpcError('对端方法执行内部异常', 32000, Object.prototype.valueOf.call(error));
}

class Rpc extends EventEmitter {
    private registeredMethods: Map<string, RpcHandler> = new Map();

    private responseCallbackMap: Map<string, ResponseCallback> = new Map();

    private transport?: Transport;

    constructor() {
        super();
        this.addListener('message', this.handleMessage);
    }

    public invoke(methodName: string, ...args: Defined[]): Promise<Result> {
        return new Promise<Result>((resolve, reject) => {
            const id = uuid();
            const requestObject = jsonrpc.request(id, methodName, args);
            this.responseCallbackMap.set(id, { resolve, reject });
            this.send(requestObject.serialize()).catch((error) => {
                this.responseCallbackMap.delete(id)
                reject(error);
            })
        })
    }

    public notify(name: string, ...args: Defined[]): Promise<unknown> {
        const notificationObject = jsonrpc.notification(name, args);
        return this.send(notificationObject.serialize());
    }

    public register(methodName: string, method: RpcHandler) {
        if (this.registeredMethods.has(methodName)) {
            throw new Error(`method ${methodName} exposed\r\n${methodName}方法已暴露`)
        }
        if (typeof method !== 'function') {
            throw new Error(`method instance must be function\r\n方法实例必须为function`)
        }
        this.registeredMethods.set(methodName, method);
    }

    public expose(methodName: string, method: RpcHandler) {
        return this.register(methodName, method);
    }

    public registerAll(methods: Array<[string, RpcHandler]>): void;
    public registerAll(methods: object): void;
    public registerAll(methods: object | Array<[string, RpcHandler]>) {
        if (!Array.isArray(methods)) {
            for (const [key, value] of Object.entries(methods)) {
                if (typeof value === 'function') {
                    this.register(key, value as RpcHandler);
                }
            }
            return;
        }

        const entries = methods;
        for (const [key, value] of entries) {
            this.register(key, value);
        }
    }

    public exposeFromObject(object: object) {
        return this.registerAll(object);
    }

    public exposeFromArray(array: Array<[string, RpcHandler]>) {
        return this.registerAll(array);
    }

    public unregister(methodName: string) {
        if (this.registeredMethods.has(methodName)) {
            this.registeredMethods.delete(methodName);
        } else {
            throw new Error(`Method ${methodName} not exist.` + `\r\nMethod ${methodName} 不存在。`)
        }
    }

    public unexpose(methodName: string) {
        return this.unregister(methodName);
    }

    public clearMethods() {
        this.registeredMethods.clear();
    }

    public unexposeAll() {
        return this.clearMethods();
    }

    public onNotification(name: string, callback: (...args: unknown[]) => void) {
        this.addListener(`notification/${name}`, callback);
    }

    public removeNotification(name: string, callback: (...data: unknown[]) => void) {
        this.removeListener(`notification/${name}`, callback);
    }

    public receive(message: string) {
        this.emit('message', message);
    }

    public setTransport(transport: Transport) {
        if (typeof transport !== 'function') {
            throw new Error('Transport must be function.' + '\r\nTransport 必须为 function。')
        }
        this.transport = transport;
    }

    public setTransmitter(transmitter: Transmitter) {
        return this.setTransport(transmitter);
    }

    private send = (message: string) => {
        if (!this.transport) return Promise.reject(new Error('Transport is nil'));
        try {
            return Promise.resolve(this.transport(message))
        } catch (error) {
            return Promise.reject(error)
        }
    }

    private sendResponse = (message: string) => {
        this.send(message).catch((error) => {
            this.emit('sendError', error);
        })
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
        const method = this.registeredMethods.get(methodName);

        if (method === undefined) {
            const errorObject = jsonrpc.error(id, jsonrpc.JsonRpcError.methodNotFound('该方法不存在或无效'))
            this.sendResponse(errorObject.serialize())
            return;
        }

        const methodCall = async (params: Defined[]) => {
            try {
                let result = await method(...params);
                if (result === undefined) {
                    result = null;
                }

                const successObject = jsonrpc.success(id, result)
                this.sendResponse(successObject.serialize())
            }
            catch (error) {
                const jsonRpcError = toRpcError(error)
                const errorObject = jsonrpc.error(id, jsonRpcError)
                this.sendResponse(errorObject.serialize())
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
        this.sendResponse(errorObject.serialize())
    }

    private handleRPCSuccess = (successObject: SuccessObject) => {
        const { id, result } = successObject;
        const callback = this.responseCallbackMap.get(id as string);
        if (callback) {
            this.responseCallbackMap.delete(id as string);
            callback.resolve(result as Result)
        }
    }

    private handleRPCError = (errorObject: ErrorObject) => {
        const { id, error } = errorObject;
        const callback = this.responseCallbackMap.get(id as string);
        if (callback) {
            this.responseCallbackMap.delete(id as string);
            callback.reject(error)
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

export { Rpc, Rpc as RPC };
