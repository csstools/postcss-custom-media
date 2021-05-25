import * as fs from 'fs/promises'
import * as es from 'esbuild'

const rootUrl = new URL('..', import.meta.url)

const pkg = JSON.parse(await fs.readFile(new URL('package.json', rootUrl), 'utf8'))

const sourceFiles = [].concat(pkg.source).map(src => new URL(src, rootUrl).pathname)

const externalDependencies = [
	...Object.keys(typeof pkg.dependencies === 'object' && pkg.dependencies || {}),
	...Object.keys(typeof pkg.peerDependencies === 'object' && pkg.peerDependencies || {}),
]

for (const esmFormat in pkg.exports?.['.']) {
	const outFile = pkg.exports['.'][esmFormat]
	const esbFormat = { 'require': 'cjs', 'import': 'esm' }[esmFormat]

	await es.build({
		entryPoints: sourceFiles,
		bundle: true,
		format: esbFormat,
		platform: 'node',
		outfile: outFile,
		external: externalDependencies,
	})
}
