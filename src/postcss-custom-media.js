import { getCustomMediaFromRoot } from './lib/getCustomMediaFromRoot.js'
import { getCustomMediaFromSources } from './lib/getCustomMediaFromSources.js'
import { transformAtrules } from './lib/transformAtrules.js'
import { writeCustomMediaToExports } from './lib/writeCustomMediaToExports.js'

// Support Custom Media Queries in CSS
const postcssCustomMedia = opts => {
	opts = typeof opts === 'object' && opts || {}

	// whether to preserve custom media and at-rules using them
	const preserve = 'preserve' in opts ? Boolean(opts.preserve) : false

	// sources to import custom media from
	const importFrom = [].concat(opts.importFrom || [])

	// destinations to export custom media to
	const exportTo = [].concat(opts.exportTo || [])

	// promise any custom media are imported
	const customMediaImportsPromise = getCustomMediaFromSources(importFrom)

	return {
		postcssPlugin: 'postcss-custom-media',
		async Once(root, helpers) {
			// combine rules from root and from imports
			helpers.customMedia = Object.assign(
				await customMediaImportsPromise,
				getCustomMediaFromRoot(root, { preserve })
			)

			await writeCustomMediaToExports(helpers.customMedia, exportTo)
		},
		AtRule: {
			media(atrule, helpers) {
				transformAtrules(atrule, { preserve }, helpers)
			},
		},
	}
}

postcssCustomMedia.postcss = true

export default postcssCustomMedia
