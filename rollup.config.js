
import nodeResolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs'

export default {
    input: './build/index.js',
    output: [
        {
            file: './dist/index.cjs',
            format: 'cjs',
        },
        {
            file: './dist/index.mjs',
            format: 'esm',
        },
        {
            file: './dist/browser.js',
            format: 'iife',
            name: 'jsonrpcv2'
        }
    ],
    plugins: [
        commonjs(),
        nodeResolve({
            preferBuiltins: false
        }),
    ]
}