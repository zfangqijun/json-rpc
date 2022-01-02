export function isNil(value: any): value is null | undefined {
    return value === null || value === undefined;
}

export function sleep(t: number) {
    return new Promise(r => setTimeout(r, t))
}