import * as U from './util'


describe('isNil', () => {
    test('null 空', () => {
        expect(U.isNil(null)).toBe(true)
    })
    test('undefined 空', () => {
        expect(U.isNil(undefined)).toBe(true)
    })
    test('[] 非空', () => {
        expect(U.isNil([])).toBe(false)
    })
    test('"" 非空', () => {
        expect(U.isNil('')).toBe(false)
    })
    test('{} 非空', () => {
        expect(U.isNil({})).toBe(false)
    })
})


