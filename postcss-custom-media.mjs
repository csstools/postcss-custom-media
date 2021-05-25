// src/lib/getMediaASTFromString.js
function parse(string, splitByAnd) {
  const array = [];
  let buffer = "";
  let split = false;
  let func = 0;
  let i = -1;
  while (++i < string.length) {
    const char = string[i];
    if (char === "(") {
      func += 1;
    } else if (char === ")") {
      if (func > 0) {
        func -= 1;
      }
    } else if (func === 0) {
      if (splitByAnd && andRegExp.test(buffer + char)) {
        split = true;
      } else if (!splitByAnd && char === ",") {
        split = true;
      }
    }
    if (split) {
      array.push(splitByAnd ? new MediaExpression(buffer + char) : new MediaQuery(buffer));
      buffer = "";
      split = false;
    } else {
      buffer += char;
    }
  }
  if (buffer !== "") {
    array.push(splitByAnd ? new MediaExpression(buffer) : new MediaQuery(buffer));
  }
  return array;
}
var MediaQueryList = class {
  constructor(string) {
    this.nodes = parse(string);
  }
  invert() {
    this.nodes.forEach((node) => {
      node.invert();
    });
    return this;
  }
  clone() {
    return new MediaQueryList(String(this));
  }
  toString() {
    return this.nodes.join(",");
  }
};
var MediaQuery = class {
  constructor(string) {
    const [, before, media, after] = string.match(spaceWrapRegExp);
    const [, modifier = "", afterModifier = " ", type = "", beforeAnd = "", and = "", beforeExpression = "", expression1 = "", expression2 = ""] = media.match(mediaRegExp) || [];
    const raws = { before, after, afterModifier, originalModifier: modifier || "", beforeAnd, and, beforeExpression };
    const nodes = parse(expression1 || expression2, true);
    Object.assign(this, {
      modifier,
      type,
      raws,
      nodes
    });
  }
  clone(overrides) {
    const instance = new MediaQuery(String(this));
    Object.assign(instance, overrides);
    return instance;
  }
  invert() {
    this.modifier = this.modifier ? "" : this.raws.originalModifier;
    return this;
  }
  toString() {
    const { raws } = this;
    return `${raws.before}${this.modifier}${this.modifier ? `${raws.afterModifier}` : ""}${this.type}${raws.beforeAnd}${raws.and}${raws.beforeExpression}${this.nodes.join("")}${this.raws.after}`;
  }
};
var MediaExpression = class {
  constructor(string) {
    const [, value, after = "", and = "", afterAnd = ""] = string.match(andRegExp) || [null, string];
    const raws = { after, and, afterAnd };
    Object.assign(this, { value, raws });
  }
  clone(overrides) {
    const instance = new MediaExpression(String(this));
    Object.assign(instance, overrides);
    return instance;
  }
  toString() {
    const { raws } = this;
    return `${this.value}${raws.after}${raws.and}${raws.afterAnd}`;
  }
};
var modifierRE = "(not|only)";
var typeRE = "(all|print|screen|speech)";
var noExpressionRE = "([\\W\\w]*)";
var expressionRE = "([\\W\\w]+)";
var noSpaceRE = "(\\s*)";
var spaceRE = "(\\s+)";
var andRE = "(?:(\\s+)(and))";
var andRegExp = new RegExp(`^${expressionRE}(?:${andRE}${spaceRE})$`, "i");
var spaceWrapRegExp = new RegExp(`^${noSpaceRE}${noExpressionRE}${noSpaceRE}$`);
var mediaRegExp = new RegExp(`^(?:${modifierRE}${spaceRE})?(?:${typeRE}(?:${andRE}${spaceRE}${expressionRE})?|${expressionRE})$`, "i");
var getMediaASTFromString = (string) => new MediaQueryList(string);

// src/lib/getCustomMediaFromRoot.js
var getCustomMediaFromRoot = (root, opts) => {
  const customMedias = {};
  root.nodes.slice().forEach((node) => {
    if (isCustomMedia(node)) {
      const [, name, selectors] = node.params.match(customMediaParamsRegExp);
      customMedias[name] = getMediaASTFromString(selectors);
      if (!Object(opts).preserve) {
        node.remove();
      }
    }
  });
  return customMedias;
};
var customMediaNameRegExp = /^custom-media$/i;
var customMediaParamsRegExp = /^(--[A-z][\w-]*)\s+([\W\w]+)\s*$/;
var isCustomMedia = (node) => node.type === "atrule" && customMediaNameRegExp.test(node.name) && customMediaParamsRegExp.test(node.params);

// src/lib/getCustomMediaFromSources.js
import fs from "fs";
import path from "path";
import { parse as parse2 } from "postcss";
async function getCustomMediaFromCSSFile(from) {
  const css = await readFile(from);
  const root = parse2(css, { from });
  return getCustomMediaFromRoot(root, { preserve: true });
}
function getCustomMediaFromObject(object) {
  const customMedia = Object.assign({}, Object(object).customMedia, Object(object)["custom-media"]);
  for (const key in customMedia) {
    customMedia[key] = getMediaASTFromString(customMedia[key]);
  }
  return customMedia;
}
async function getCustomMediaFromJSONFile(from) {
  const object = await readJSON(from);
  return getCustomMediaFromObject(object);
}
async function getCustomMediaFromJSFile(from) {
  const object = await import(from);
  return getCustomMediaFromObject(object);
}
var getCustomMediaFromSources = (sources) => sources.map((source) => {
  if (source instanceof Promise) {
    return source;
  } else if (source instanceof Function) {
    return source();
  }
  const opts = source === Object(source) ? source : { from: String(source) };
  if (Object(opts).customMedia || Object(opts)["custom-media"]) {
    return opts;
  }
  const from = path.resolve(String(opts.from || ""));
  const type = (opts.type || path.extname(from).slice(1)).toLowerCase();
  return { type, from };
}).reduce(async (customMedia, source) => {
  const { type, from } = await source;
  if (type === "css" || type === "pcss") {
    return Object.assign(await customMedia, await getCustomMediaFromCSSFile(from));
  }
  if (type === "js") {
    return Object.assign(await customMedia, await getCustomMediaFromJSFile(from));
  }
  if (type === "json") {
    return Object.assign(await customMedia, await getCustomMediaFromJSONFile(from));
  }
  return Object.assign(await customMedia, getCustomMediaFromObject(await source));
}, {});
var readFile = (from) => new Promise((resolve, reject) => {
  fs.readFile(from, "utf8", (error, result) => {
    if (error) {
      reject(error);
    } else {
      resolve(result);
    }
  });
});
var readJSON = async (from) => JSON.parse(await readFile(from));

// src/lib/getTransformedMediaList.js
var getTransformedMediaList = (mediaList, customMedias) => {
  let index = mediaList.nodes.length - 1;
  while (index >= 0) {
    const transformedMedias = transformMedia(mediaList.nodes[index], customMedias);
    if (transformedMedias.length) {
      mediaList.nodes.splice(index, 1, ...transformedMedias);
    }
    --index;
  }
  return mediaList;
};
function transformMedia(media, customMedias) {
  const transpiledMedias = [];
  for (const index in media.nodes) {
    const { value, nodes } = media.nodes[index];
    const key = value.replace(customPseudoRegExp, "$1");
    if (key in customMedias) {
      for (const replacementMedia of customMedias[key].nodes) {
        const modifier = media.modifier !== replacementMedia.modifier ? media.modifier || replacementMedia.modifier : "";
        const mediaClone = media.clone({
          modifier,
          raws: !modifier || media.modifier ? { ...media.raws } : { ...replacementMedia.raws },
          type: media.type || replacementMedia.type
        });
        if (mediaClone.type === replacementMedia.type) {
          Object.assign(mediaClone.raws, {
            and: replacementMedia.raws.and,
            beforeAnd: replacementMedia.raws.beforeAnd,
            beforeExpression: replacementMedia.raws.beforeExpression
          });
        }
        mediaClone.nodes.splice(index, 1, ...replacementMedia.clone().nodes.map((node) => {
          if (media.nodes[index].raws.and) {
            node.raws = { ...media.nodes[index].raws };
          }
          node.spaces = { ...media.nodes[index].spaces };
          return node;
        }));
        const nextCustomMedia = getCustomMediasWithoutKey(customMedias, key);
        const retranspiledMedias = transformMedia(mediaClone, nextCustomMedia);
        if (retranspiledMedias.length) {
          transpiledMedias.push(...retranspiledMedias);
        } else {
          transpiledMedias.push(mediaClone);
        }
      }
      return transpiledMedias;
    } else if (nodes && nodes.length) {
      getTransformedMediaList(media.nodes[index], customMedias);
    }
  }
  return transpiledMedias;
}
var customPseudoRegExp = /\((--[A-z][\w-]*)\)/;
var getCustomMediasWithoutKey = (customMedias, key) => {
  const nextCustomMedias = Object.assign({}, customMedias);
  delete nextCustomMedias[key];
  return nextCustomMedias;
};

// src/lib/transformAtrules.js
var transformAtrules = (atrule, { preserve }, { customMedia }) => {
  if (customPseudoRegExp2.test(atrule.params)) {
    if (!atrule[visitedFlag]) {
      atrule[visitedFlag] = true;
      const mediaAST = getMediaASTFromString(atrule.params);
      const params = String(getTransformedMediaList(mediaAST, customMedia));
      if (preserve) {
        const node = atrule.cloneAfter();
        node[visitedFlag] = true;
      }
      if (params != null) {
        atrule.params = params;
      }
    }
  }
};
var visitedFlag = Symbol("customMediaVisited");
var customPseudoRegExp2 = /\(--[A-z][\w-]*\)/;

// src/lib/writeCustomMediaToExports.js
import fs2 from "fs";
import path2 from "path";
async function writeCustomMediaToCssFile(to, customMedia) {
  const cssContent = Object.keys(customMedia).reduce((cssLines, name) => {
    cssLines.push(`@custom-media ${name} ${customMedia[name]};`);
    return cssLines;
  }, []).join("\n");
  const css = `${cssContent}
`;
  await writeFile(to, css);
}
async function writeCustomMediaToJsonFile(to, customMedia) {
  const jsonContent = JSON.stringify({
    "custom-media": customMedia
  }, null, "  ");
  const json = `${jsonContent}
`;
  await writeFile(to, json);
}
async function writeCustomMediaToCjsFile(to, customMedia) {
  const jsContents = Object.keys(customMedia).reduce((jsLines, name) => {
    jsLines.push(`		'${escapeForJS(name)}': '${escapeForJS(customMedia[name])}'`);
    return jsLines;
  }, []).join(",\n");
  const js = `module.exports = {
	customMedia: {
${jsContents}
	}
};
`;
  await writeFile(to, js);
}
async function writeCustomMediaToMjsFile(to, customMedia) {
  const mjsContents = Object.keys(customMedia).reduce((mjsLines, name) => {
    mjsLines.push(`	'${escapeForJS(name)}': '${escapeForJS(customMedia[name])}'`);
    return mjsLines;
  }, []).join(",\n");
  const mjs = `export const customMedia = {
${mjsContents}
};
`;
  await writeFile(to, mjs);
}
var writeCustomMediaToExports = (customMedia, destinations) => Promise.all(destinations.map(async (destination) => {
  if (destination instanceof Function) {
    await destination(defaultCustomMediaToJSON(customMedia));
  } else {
    const opts = destination === Object(destination) ? destination : { to: String(destination) };
    const toJSON = opts.toJSON || defaultCustomMediaToJSON;
    if ("customMedia" in opts) {
      opts.customMedia = toJSON(customMedia);
    } else if ("custom-media" in opts) {
      opts["custom-media"] = toJSON(customMedia);
    } else {
      const to = String(opts.to || "");
      const type = (opts.type || path2.extname(to).slice(1)).toLowerCase();
      const customMediaJSON = toJSON(customMedia);
      if (type === "css") {
        await writeCustomMediaToCssFile(to, customMediaJSON);
      }
      if (type === "js") {
        await writeCustomMediaToCjsFile(to, customMediaJSON);
      }
      if (type === "json") {
        await writeCustomMediaToJsonFile(to, customMediaJSON);
      }
      if (type === "mjs") {
        await writeCustomMediaToMjsFile(to, customMediaJSON);
      }
    }
  }
}));
var defaultCustomMediaToJSON = (customMedia) => {
  return Object.keys(customMedia).reduce((customMediaJSON, key) => {
    customMediaJSON[key] = String(customMedia[key]);
    return customMediaJSON;
  }, {});
};
var writeFile = (to, text) => new Promise((resolve, reject) => {
  fs2.writeFile(to, text, (error) => {
    if (error) {
      reject(error);
    } else {
      resolve();
    }
  });
});
var escapeForJS = (string) => string.replace(/\\([\s\S])|(')/g, "\\$1$2").replace(/\n/g, "\\n").replace(/\r/g, "\\r");

// src/postcss-custom-media.js
var postcssCustomMedia = (opts) => {
  opts = typeof opts === "object" && opts || {};
  const preserve = "preserve" in opts ? Boolean(opts.preserve) : false;
  const importFrom = [].concat(opts.importFrom || []);
  const exportTo = [].concat(opts.exportTo || []);
  const customMediaImportsPromise = getCustomMediaFromSources(importFrom);
  return {
    postcssPlugin: "postcss-custom-media",
    async Once(root, helpers) {
      helpers.customMedia = Object.assign(await customMediaImportsPromise, getCustomMediaFromRoot(root, { preserve }));
      await writeCustomMediaToExports(helpers.customMedia, exportTo);
    },
    AtRule: {
      media(atrule, helpers) {
        transformAtrules(atrule, { preserve }, helpers);
      }
    }
  };
};
postcssCustomMedia.postcss = true;
var postcss_custom_media_default = postcssCustomMedia;
export {
  postcss_custom_media_default as default
};
