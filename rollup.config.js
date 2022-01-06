
import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs'
import { terser } from 'rollup-plugin-terser'

export default {
    input: './build/index.js',
    output: [
        {
            file: './dist/index.js',
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
        terser({
            mangle: false
        }),
    ]
}