import { EventEmitter } from 'events'
import { jsonrpc } from 'jsonrpc-lite'
import { Result, Rpc, RPC } from './rpc'

const createPair = () => {
    const transport = new EventEmitter();
    const local = new Rpc();
    const remote = new Rpc();

    transport.on('remote-to-local', (message) => {
        local.receive(message);
    })

    transport.on('local-to-remote', (message) => {
        remote.receive(message)
    })

    local.setTransport((message) => {
        transport.emit('local-to-remote', message)
    })

    remote.setTransport((message) => {
        transport.emit('remote-to-local', message)
    })

    return { local, remote };
}

const pendingCount = (rpc: Rpc) => {
    return (rpc as unknown as { responseCallbackMap: Map<string, unknown> }).responseCallbackMap.size;
}

describe('setTransport', () => {
    it('accepts an async transport', () => {
        const rpc = new Rpc();
        const transport = async () => undefined;

        expect(rpc.setTransport(transport)).toBeUndefined();
    })

    it('accepts a sync transport', async () => {
        const { local, remote } = createPair();
        remote.register('syncMethod', () => 'syncMethod.result')

        await expect(local.invoke('syncMethod')).resolves.toBe('syncMethod.result');
    })

    it('throws when transport is not a function', () => {
        const rpc = new Rpc();

        expect(() => {
            // @ts-ignore
            rpc.setTransport('')
        }).toThrow();
    })
})

describe('register', () => {
    it('registers methods', () => {
        const rpc = new Rpc();
        const syncMethod = jest.fn((...args) => ({ method: 'syncMethod', invokeArgs: args }));
        const asyncMethod = jest.fn(async (...args) => ({ method: 'asyncMethod', invokeArgs: args }));

        expect(rpc.register('syncMethod', syncMethod)).toBeUndefined();
        expect(rpc.register('asyncMethod', asyncMethod)).toBeUndefined();
    })

    test('多次注册同名函数 应该抛异常', () => {
        const rpc = new Rpc();
        rpc.register('syncMethod', jest.fn())

        expect(() => {
            rpc.register('syncMethod', () => { });
        }).toThrow();
    })

    test('注册的方法实例不是函数 应该抛异常', () => {
        const rpc = new Rpc();

        expect(() => {
            // @ts-ignore
            rpc.register('method', {});
        }).toThrow();
    })
})

describe('registerAll', () => {
    it('registers methods from an object', () => {
        const rpc = new Rpc();

        expect(rpc.registerAll({
            'registerAll.syncMethod': jest.fn(),
            'registerAll.asyncMethod': jest.fn(),
        })).toBeUndefined();
    })

    test('多次注册同名函数 应该抛异常', () => {
        const rpc = new Rpc();
        rpc.registerAll({
            'registerAll.syncMethod': jest.fn(),
            'registerAll.asyncMethod': jest.fn(),
        })

        expect(() => {
            rpc.registerAll({
                'registerAll.syncMethod': jest.fn(),
                'registerAll.asyncMethod': jest.fn(),
            })
        }).toThrow();
    })

    it('ignores non-function object properties', () => {
        const rpc = new Rpc();

        expect(rpc.registerAll({
            method: jest.fn(),
            name: 'not-a-method',
        })).toBeUndefined();
    })

    it('registers methods from an array', () => {
        const rpc = new Rpc();

        expect(rpc.registerAll([
            ['registerAllFromArray.syncMethod', jest.fn()],
            ['registerAllFromArray.asyncMethod', jest.fn()]
        ])).toBeUndefined();
    })

    test('数组多次注册同名函数 应该抛异常', () => {
        const rpc = new Rpc();
        rpc.registerAll([
            ['registerAllFromArray.syncMethod', jest.fn()],
            ['registerAllFromArray.asyncMethod', jest.fn()]
        ])

        expect(() => {
            rpc.registerAll([
                ['registerAllFromArray.syncMethod', jest.fn()],
                ['registerAllFromArray.asyncMethod', jest.fn()]
            ])
        }).toThrow();
    })
})

describe('unregister', () => {
    test('反注册成功', () => {
        const rpc = new Rpc();
        rpc.register('test.unexpose', jest.fn())

        expect(rpc.unregister('test.unexpose')).toBeUndefined();
    });

    test('反注册不存在的方法 应该抛异常', () => {
        const rpc = new Rpc();

        expect(() => {
            rpc.unregister('test.unexpose')
        }).toThrow();
    })
})

describe('clearMethods', () => {
    test('反注册成功', () => {
        const rpc = new Rpc();
        rpc.registerAll({
            'test.method1': jest.fn(),
            'test.method2': jest.fn()
        })

        expect(rpc.clearMethods()).toBeUndefined();
        expect(() => rpc.unregister('test.method1')).toThrow();
    });
})

describe('invoke', () => {
    test('没有返回值的函数 返回null', async () => {
        const { local, remote } = createPair();
        remote.register('noResultMethod', jest.fn())

        await expect(local.invoke('noResultMethod')).resolves.toBeNull()
        expect(pendingCount(local)).toBe(0);
    });

    test('调用的函数抛异常 reject', async () => {
        const { local, remote } = createPair();
        remote.register('rejectMethod', jest.fn().mockRejectedValue('rejectMethod.value'))
        remote.register('throwMethod', () => { throw 'throwMethod.value' })

        await expect(local.invoke('rejectMethod')).rejects.toMatchObject({ data: 'rejectMethod.value' })
        expect(pendingCount(local)).toBe(0);

        await expect(local.invoke('throwMethod')).rejects.toMatchObject({ data: 'throwMethod.value' })
        expect(pendingCount(local)).toBe(0);
    });

    test('调用的函数抛出 JSON-RPC 错误时原样返回', async () => {
        const { local, remote } = createPair();
        const remoteError = new jsonrpc.JsonRpcError('Remote method failed', -32010, { reason: 'remote-error' });
        remote.register('rpcErrorMethod', jest.fn().mockRejectedValue(remoteError))

        await expect(local.invoke('rpcErrorMethod')).rejects.toMatchObject({
            code: -32010,
            message: 'Remote method failed',
            data: { reason: 'remote-error' },
        })
        expect(pendingCount(local)).toBe(0);
    });

    test('调用的函数抛出远端错误对象时原样返回', async () => {
        const { local, remote } = createPair();
        remote.register('plainRpcErrorMethod', jest.fn().mockRejectedValue({
            code: -32011,
            message: 'Plain remote error',
            data: { reason: 'plain-remote-error' },
        }))

        await expect(local.invoke('plainRpcErrorMethod')).rejects.toMatchObject({
            code: -32011,
            message: 'Plain remote error',
            data: { reason: 'plain-remote-error' },
        })
        expect(pendingCount(local)).toBe(0);
    });

    test('no args', async () => {
        const { local, remote } = createPair();
        remote.register('syncMethod', jest.fn((...args) => ({ method: 'syncMethod', invokeArgs: args as Result[] })));

        await expect(local.invoke('syncMethod')).resolves.toEqual({ method: 'syncMethod', invokeArgs: [] })
        expect(pendingCount(local)).toBe(0);
    });

    test('multiple args', async () => {
        const { local, remote } = createPair();
        remote.register('asyncMethod', jest.fn(async (...args) => ({ method: 'asyncMethod', invokeArgs: args as Result[] })));

        await expect(local.invoke('asyncMethod', 'string', 2188, false, {}, [])).resolves.toEqual({
            method: 'asyncMethod',
            invokeArgs: ['string', 2188, false, {}, []]
        })
        expect(pendingCount(local)).toBe(0);
    });

    test('returns arrays as valid JSON results', async () => {
        const { local, remote } = createPair();
        remote.register('arrayMethod', () => ['string', 2188, false, null])

        await expect(local.invoke('arrayMethod')).resolves.toEqual(['string', 2188, false, null])
        expect(pendingCount(local)).toBe(0);
    });

    test('fail', async () => {
        const { local } = createPair();

        await expect(local.invoke('methodNotFound')).rejects.toMatchObject({ code: -32601 })
        expect(pendingCount(local)).toBe(0);
    });

    test('send failure rejects and clears pending callback', async () => {
        const local = new Rpc();
        const error = new Error('send failed');
        local.setTransport(() => {
            throw error;
        })

        await expect(local.invoke('syncMethod')).rejects.toBe(error);
        expect(pendingCount(local)).toBe(0);
    });
})

describe('notify', () => {
    test('no args', async () => {
        const { local, remote } = createPair();
        const mockNotificationListener = jest.fn();
        remote.onNotification('test-notification', mockNotificationListener)

        await expect(local.notify('test-notification')).resolves.toBeUndefined();
        expect(mockNotificationListener).toBeCalled()
    });

    test('multiple args', async () => {
        const { local, remote } = createPair();
        const mockNotificationListener = jest.fn();
        remote.onNotification('test-notification', mockNotificationListener)

        await expect(local.notify('test-notification', 'string', 2188, false, {}, [])).resolves.toBeUndefined();
        expect(mockNotificationListener).toBeCalledWith('string', 2188, false, {}, [])
    });

    test('object args', async () => {
        const { local, remote } = createPair();
        const mockNotificationListener = jest.fn();
        remote.onNotification('test-notification', mockNotificationListener)

        await expect(local.notify('test-notification', { a: 1 })).resolves.toBeUndefined();
        expect(mockNotificationListener).toBeCalledWith({ a: 1 })
    });

    test('removeNotification', async () => {
        const { local, remote } = createPair();
        const mockNotificationListener = jest.fn();
        remote.onNotification('test-notification', mockNotificationListener)

        expect(remote.removeNotification('test-notification', mockNotificationListener)).toBeUndefined()
        await expect(local.notify('test-notification')).resolves.toBeUndefined();
        expect(mockNotificationListener).not.toBeCalled();
    })

    test('send failure rejects', async () => {
        const local = new Rpc();
        const error = new Error('send failed');
        local.setTransport(() => Promise.reject(error))

        await expect(local.notify('test-notification')).rejects.toBe(error);
    });
})

describe('response sending', () => {
    test('emits sendError when sending a response fails', async () => {
        const rpc = new Rpc();
        const sendError = new Error('response failed');
        const onSendError = jest.fn();
        rpc.setTransport(() => Promise.reject(sendError))
        rpc.register('syncMethod', () => 'syncMethod.result')
        rpc.on('sendError', onSendError)

        rpc.receive(JSON.stringify({
            jsonrpc: '2.0',
            id: 'request-id',
            method: 'syncMethod'
        }))

        await Promise.resolve();
        await Promise.resolve();
        expect(onSendError).toBeCalledWith(sendError);
    })
})

describe('compatibility aliases', () => {
    test('keeps the old API names working', async () => {
        const transport = new EventEmitter();
        const local = new RPC();
        const remote = new RPC();

        transport.on('remote-to-local', (message) => local.receive(message))
        transport.on('local-to-remote', (message) => remote.receive(message))

        local.setTransmitter((message) => transport.emit('local-to-remote', message))
        remote.setTransmitter((message) => transport.emit('remote-to-local', message))

        remote.expose('legacyMethod', () => 'legacy.result')
        remote.exposeFromObject({ legacyObjectMethod: () => 'legacy.object.result' })
        remote.exposeFromArray([['legacyArrayMethod', () => 'legacy.array.result']])

        await expect(local.invoke('legacyMethod')).resolves.toBe('legacy.result');
        await expect(local.invoke('legacyObjectMethod')).resolves.toBe('legacy.object.result');
        await expect(local.invoke('legacyArrayMethod')).resolves.toBe('legacy.array.result');

        expect(remote.unexpose('legacyMethod')).toBeUndefined();
        expect(remote.unexposeAll()).toBeUndefined();
    })
})
