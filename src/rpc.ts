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

    public call(methodName: string, args?: CallArgs) {
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

    public notify(name: string, args?: CallArgs) {
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

    public unexpose(methodName: string) {
        if (this.exposeMethods.has(methodName)) {
            this.exposeMethods.delete(methodName);
        } else {
            throw new Error(`method ${methodName} not exist\r\n${methodName}方法 不存在`)
        }
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
            throw new Error(`transmitter must be function\r\ntransmitter必须为function`)
        }
        this.transmitter = transmitter;
    }

    private send = (message: string) => {
        if (!this.transmitter) return Promise.reject(new Error('transmitter is nil'));
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
            const errorObject = jsonrpc.error(id, jsonrpc.JsonRpcError.methodNotFound({ message: `方法不存在` }))
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
                const errorObject = jsonrpc.error(id, jsonrpc.JsonRpcError.internalError({ message: `方法调用内部异常`, error }))
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

        const errorObject = jsonrpc.error(id, jsonrpc.JsonRpcError.invalidParams({ message: `传入的参数格式错误` }))
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
            this.emit(`notification/${method}`, params);
        } else {
            this.emit(`notification/${method}`);
        }
    }
}

export { RPC };
