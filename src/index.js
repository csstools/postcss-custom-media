import postcss from 'postcss';
import { readCustom, readCustomFromRoot, transformRootWithCustomMedia, writeCustom } from 'postcss-custom-utils';

export default postcss.plugin('postcss-custom-media', opts => {
	// whether to preserve custom media and at-rules using them
	const preserve = 'preserve' in Object(opts) ? Boolean(opts.preserve) : false;

	// sources to import custom media from
	const importFrom = [].concat(Object(opts).importFrom || []);

	// destinations to export custom media to
	const exportTo = [].concat(Object(opts).exportTo || []);

	return async root => {
		const customFromImports = await readCustom(...importFrom);
		const customFromRoot = await readCustomFromRoot(root, preserve);
		const customMedia = Object.assign({}, customFromImports.customMedia, customFromRoot.customMedia);

		transformRootWithCustomMedia(root, customMedia, preserve);

		await writeCustom({ customMedia }, ...exportTo);
	};
});
