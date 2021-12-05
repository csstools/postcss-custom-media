import getCustomMediaFromRoot from './lib/custom-media-from-root';
import getCustomMediaFromImports from './lib/get-custom-media-from-imports';
import transformAtrules from './lib/transform-atrules';
import writeCustomMediaToExports from './lib/write-custom-media-to-exports';

const creator = opts => {
	// whether to preserve custom media and at-rules using them
	const preserve = 'preserve' in Object(opts) ? Boolean(opts.preserve) : false;

	// sources to import custom media from
	const importFrom = [].concat(Object(opts).importFrom || []);

	// destinations to export custom media to
	const exportTo = [].concat(Object(opts).exportTo || []);

	// promise any custom media are imported
	const customMediaImports = getCustomMediaFromImports(importFrom);

	return {
		postcssPlugin: 'postcss-custom-media',
		Once: (root, helpers) => {
			// combine rules from root and from imports
			const update = customMediaImports => {
				helpers.customMedia = Object.assign(
					customMediaImports,
					getCustomMediaFromRoot(root, { preserve })
				);
			};

			const write = () => writeCustomMediaToExports(
				helpers.customMedia,
				exportTo
			);

			if (customMediaImports instanceof Promise) {
				return customMediaImports.then(update).then(write);
			} else {
				update(customMediaImports);
				return write();
			}
		},
		AtRule: {
			media: (atrule, helpers) => {
				transformAtrules(atrule, {preserve}, helpers)
			}
		}
	}
}

creator.postcss = true

export default creator
