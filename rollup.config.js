import commonjs from '@rollup/plugin-commonjs'
import replace from '@rollup/plugin-replace'
import resolve from '@rollup/plugin-node-resolve'
import { getBabelOutputPlugin } from '@rollup/plugin-babel'

export default {
  input: 'lib/index.js',
  output: {
    file: 'dist/fs-extra.js',
    format: 'iife',
    exports: 'auto',
    banner: 'module.exports = function fsExtraFactory(__EXTERNAL__) {\n',
    footer: '\nreturn fsExtra\n}',
    name: 'fsExtra',
  },
  plugins: [
    replace({
      'process.env.NODE_ENV': '"production"'
    }),
    resolve(),
    commonjs(),
    getBabelOutputPlugin({
      plugins: [
        ['@babel/plugin-proposal-object-rest-spread', {
          useBuiltIns: true,
          loose: true
        }]
      ],
      allowAllFormats: true,
    })
  ],
  external: ['assert', 'browserfs']
}