import {RpcObject, RequestObject, ResponseSuccessObject, ResponseErrorObject} from './objects/base-object'
import {InternalError, InvalidParamsError, MethodNotFoundError, RpcError} from './objects/error'

interface RegisterOptions {
    parameterStructures: 'by-position' | 'by-name'
}

interface FunctionInfo {
    func: Function
    options: RegisterOptions
}

type Transport = (message: string) => void

const defaultOptions: RegisterOptions = {
    parameterStructures: 'by-position',
}

class RPC {
    private invokeResultCallbacks: Map<string, Function> = new Map()

    private registry: Map<string, FunctionInfo> = new Map()

    private transport?: Transport

    public invoke(method: string, ...args: any[]) {
        return new Promise((resolve) => {
            const requestObject = new RequestObject(method, args)
            const id = requestObject.getId()
            this.invokeResultCallbacks.set(id, (result: any) => {
                resolve(result)
            })
            this.sendViaTransport(requestObject)
        })
    }

    public register(method: string, func: Function, options?: RegisterOptions) {
        if (this.registry.has(method)) {
            throw new Error(`Method ${method} already exist.`)
        }

        this.registry.set(method, {
            func,
            options: Object.assign({}, defaultOptions, options),
        })
    }

    public unregister(method: string) {
        if (this.registry.has(method)) {
            this.registry.delete(method)
        } else {
            throw new Error(`Method ${method} not exist.`)
        }
    }

    public receive(message: string) {
        this.handleMessage(message)
    }

    public setTransport(transport: Transport) {
        this.transport = transport
    }

    private sendViaTransport(object: RpcObject) {
        if (!this.transport) {
            throw new Error('Transport not set.')
        }
        this.transport(JSON.stringify(object.toJson()))
    }

    private handleMessage(message: string) {
        const object = RpcObject.fromJson(JSON.parse(message))
        if (object instanceof RequestObject) {
            this.handleRequest(object)
        }
        if (object instanceof ResponseSuccessObject) {
            this.handleResponseSuccess(object)
        }

        if (object instanceof ResponseErrorObject) {
            this.handleResponseError(object)
        }
    }

    private handleRequest(object: RequestObject) {
        const id = object.getId()
        const method = object.getMethod()
        const params = object.getParams()

        const info = this.registry.get(method)
        if (!info) {
            this.sendViaTransport(new ResponseErrorObject(id, new MethodNotFoundError()))
            return
        }

        const {func, options} = info

        const funcByPosition = async (params: any[]) => {
            try {
                const result = await func.call(null, ...params)
                this.sendViaTransport(new ResponseSuccessObject(id, result))
            } catch (error) {
                this.sendError(id, error)
            }
        }

        const funcByName = async (params: any) => {
            try {
                const result = await func.call(null, params)
                this.sendViaTransport(new ResponseSuccessObject(id, result))
            } catch (error) {
                this.sendError(id, error)
            }
        }

        if (options.parameterStructures === 'by-position') {
            if (Array.isArray(params)) {
                funcByPosition(params)
            } else {
                this.sendViaTransport(new ResponseErrorObject(id, new InvalidParamsError('Must be by-position.')))
            }
        } else {
            if (typeof params === 'object') {
                funcByName(params)
            } else {
                this.sendViaTransport(new ResponseErrorObject(id, new InvalidParamsError('Must be by-name.')))
            }
        }
    }

    private handleResponseSuccess(object: ResponseSuccessObject) {
        const id = object.getId()
        const listener = this.invokeResultCallbacks.get(id)
        if (listener) {
            listener(object.getResult())
            this.invokeResultCallbacks.delete(id)
        }
    }

    private handleResponseError(object: ResponseErrorObject) {
        const id = object.getId()
        const listener = this.invokeResultCallbacks.get(id)
        if (listener) {
            listener(Promise.reject(object.getError()))
            this.invokeResultCallbacks.delete(id)
        }
    }

    private sendError(id: string, error: RpcError | Error | any) {
        if (error instanceof RpcError) {
            this.sendViaTransport(new ResponseErrorObject(id, error))
        } else if (error instanceof Error) {
            this.sendViaTransport(new ResponseErrorObject(id, new InternalError(error.message)))
        } else {
            this.sendViaTransport(new ResponseErrorObject(id, new InternalError(error)))
        }
    }
}

export {RPC}
