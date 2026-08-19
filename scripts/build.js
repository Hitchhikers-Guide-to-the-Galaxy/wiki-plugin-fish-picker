import esbuild from 'esbuild'
import { readFileSync } from 'node:fs'
const { version } = JSON.parse(readFileSync('package.json', 'utf8'))
await esbuild.build({
  entryPoints: ['src/wiki-fish-picker.js'],
  bundle: false, // a single hand-written IIFE; nothing to bundle
  format: 'iife',
  outfile: 'client/wiki-fish-picker.js',
  sourcemap: true,
  minify: true,
  banner: { js: `/* wiki-plugin-fish-picker ${version} */` },
})
console.log('built client/wiki-fish-picker.js (v' + version + ')')
