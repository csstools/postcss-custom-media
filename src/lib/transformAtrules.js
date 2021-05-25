import { getTransformedMediaList } from "./getTransformedMediaList.js"
import { getMediaASTFromString } from "./getMediaASTFromString.js"

// transform custom pseudo selectors with custom selectors
export const transformAtrules = (atrule, { preserve }, { customMedia }) => {
	if (customPseudoRegExp.test(atrule.params)) {
		// prevent infinite loops when using 'preserve' option
		if (!atrule[visitedFlag]) {
			atrule[visitedFlag] = true

			const mediaAST = getMediaASTFromString(atrule.params)
			const params = String(getTransformedMediaList(mediaAST, customMedia))

			if (preserve) {
				// keep an original copy
				const node = atrule.cloneAfter()
				node[visitedFlag] = true
			}
			// replace the variable with the params from @custom-media rule
			// skip if the variable is undefined
			if (params != null) {
				atrule.params = params
			}
		}
	}
}

const visitedFlag = Symbol("customMediaVisited")
const customPseudoRegExp = /\(--[A-z][\w-]*\)/
