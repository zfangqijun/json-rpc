import { RPC } from './rpc'
import { EventEmitter } from 'events'
import jsonrpc from 'jsonrpc-lite';

const transport = new EventEmitter();
const local = new RPC();
const remote = new RPC();

remote.expose('noResultMethod', jest.fn())
remote.expose('rejectMethod', jest.fn().mockRejectedValue('rejectMethod.value'))
remote.expose('throwMethod', () => { throw 'throwMethod.value' })

transport.on('remote-to-local', (message) => {
    local.receive(message);
})

transport.on('local-to-remote', (message) => {
    remote.receive(message)
})

const syncMethod = jest.fn((...args) => { return { method: 'syncMethod', callArgs: args } });
const asyncMethod = jest.fn(async (...args) => { return { method: 'asyncMethod', callArgs: args } });

describe('setTransmitter', () => {
    it('setTransmitter', () => {
        const localtransmitter = async (message: string) => {
            transport.emit('local-to-remote', message)
        }
        expect(local.setTransmitter(localtransmitter)).toBeUndefined();

        const remotetransmitter = async (message: string) => {
            transport.emit('remote-to-local', message)
        }
        expect(remote.setTransmitter(remotetransmitter)).toBeUndefined();
    })

    it('setTransmitter fail', () => {
        expect(() => {
            // @ts-ignore
            remote.setTransmitter('')
        }).toThrow();
    })
})

describe('expose', () => {
    it('expose methods', () => {
        remote.expose('syncMethod', syncMethod)
        remote.expose('asyncMethod', asyncMethod)
    })

    test('多次注册同名函数 应该抛异常', () => {
        expect(() => {
            remote.expose('asyncMethod', () => { });
        }).toThrow();
    })

    test('注册的方法实例不是函数 应该抛异常', () => {
        expect(() => {
            // @ts-ignore
            remote.expose('method', {});
        }).toThrow();
    })
})

describe('unexpose', () => {
    local.expose('test.unexpose', jest.fn())

    test('反注册成功', () => {
        local.unexpose('test.unexpose')
    });

    test('反注册不存在的方法 应该抛异常', () => {
        expect(() => {
            local.unexpose('test.unexpose')
        }).toThrow();
    })
})


describe('call', () => {
    test('没有返回值的函数 返回null', () => {
        const result = local.call('noResultMethod')
        expect(result).resolves.toBeNull()
    });

    test('调用的函数抛异常 reject', () => {
        expect(local.call('rejectMethod')).rejects.toMatchObject({ data: { error: 'rejectMethod.value' } })
        expect(local.call('throwMethod')).rejects.toMatchObject({ data: { error: 'throwMethod.value' } })
    });

    test('no args', () => {
        const result = local.call('syncMethod');
        expect(result).resolves.toEqual({ method: 'syncMethod', callArgs: [] })
    });

    test('multiple args', () => {
        const result = local.call('asyncMethod', ['string', 2188, false, {}, []]);
        expect(result).resolves.toEqual({ method: 'asyncMethod', callArgs: ['string', 2188, false, {}, []] })
    });

    test('fail', () => {
        const result = local.call('methodNotFound');
        expect(result).rejects.toMatchObject({ code: -32601 })
    });
})

describe('invoke', () => {
    test('没有返回值的函数 返回null', () => {
        const result = local.invoke('noResultMethod')
        expect(result).resolves.toBeNull()
    });

    test('调用的函数抛异常 reject', () => {
        expect(local.invoke('rejectMethod')).rejects.toMatchObject({ data: { error: 'rejectMethod.value' } })
        expect(local.invoke('throwMethod')).rejects.toMatchObject({ data: { error: 'throwMethod.value' } })
    });

    test('no args', () => {
        const result = local.invoke('syncMethod');
        expect(result).resolves.toEqual({ method: 'syncMethod', callArgs: [] })
    });

    test('multiple args', () => {
        const result = local.invoke('asyncMethod', 'string', 2188, false, {}, []);
        expect(result).resolves.toEqual({ method: 'asyncMethod', callArgs: ['string', 2188, false, {}, []] })
    });

    test('fail', () => {
        const result = local.invoke('methodNotFound');
        expect(result).rejects.toMatchObject({ code: -32601 })
    });
})

describe('notify', () => {
    const mockNotificationListener = jest.fn();
    test('onNotification', () => {
        expect(remote.onNotification('test-notification', mockNotificationListener)).toBeUndefined()
    })
    test('no args', () => {
        local.notify('test-notification');
        expect(mockNotificationListener).toBeCalled()
        mockNotificationListener.mockClear();
    });
    test('multiple args', () => {
        local.notify('test-notification', ['string', 2188, false, {}, []]);
        expect(mockNotificationListener).toBeCalledWith(['string', 2188, false, {}, []])
        mockNotificationListener.mockClear();
    });
    test('removeNotification', () => {
        expect(remote.removeNotification('test-notification', mockNotificationListener)).toBeUndefined()
    })
})



