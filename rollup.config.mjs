import typescript from '@rollup/plugin-typescript';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import terser from '@rollup/plugin-terser';
import { readFileSync } from 'fs';

const pkg = JSON.parse(readFileSync('./package.json', 'utf8'));

const banner = `/*!
 * ${pkg.name} v${pkg.version}
 * ${pkg.description}
 * 
 * Copyright (c) ${new Date().getFullYear()} ${pkg.author}
 * Released under the ${pkg.license} License.
 */`;

const external = [
  ...Object.keys(pkg.dependencies || {}),
  ...Object.keys(pkg.peerDependencies || {})
];

const plugins = [
  resolve({
    browser: true,
    preferBuiltins: false
  }),
  commonjs(),
  typescript({
    tsconfig: './tsconfig.json',
    declaration: true,
    declarationDir: './dist',
    rootDir: './src'
  })
];

export default [
  // UMD build
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/index.umd.js',
      format: 'umd',
      name: 'Laxios',
      banner,
      globals: {}
    },
    plugins: [...plugins, terser()],
    external: []
  },
  
  // CommonJS build
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/index.js',
      format: 'cjs',
      banner,
      exports: 'named'
    },
    plugins,
    external
  },
  
  // ES Module build
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/index.esm.js',
      format: 'esm',
      banner
    },
    plugins,
    external
  }
];