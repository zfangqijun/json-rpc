await Bun.build({
    entrypoints: ['./src/rpcv2.ts'],
    outdir: './dist',
    sourcemap: 'external',
}).then(console.log)
