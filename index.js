const HTMLParser = require('./util/HTMLParser')
const path = require('path')
const defaultHandler = require('./lib/defaultHandler')

let 
, HAS_SCRIPT_SECTION
const ALL_PREFIXED_TAGS = new Map()

/**
 * 
 * @param {Set} tags 
 * @param {Array} prefixes like [[prefix, path], ...]
 * @return {Map} [[tag, fullPath], ...]
 */
const sortTagsList = (tags, prefixes, relPath) => {
  const result = new Map();
  tags.forEach(tag => {
    const [prefix, block, elem] = tag.replace(/\B([A-Z])/g, '|$1').split('|', 3)
    prefixes.forEach(([pre, handler]) => {
      if (pre !== prefix || result.has(tag)) return
      if (ALL_PREFIXED_TAGS.has(tag)) {
        result.set(tag, ALL_PREFIXED_TAGS.get(tag))
      } else {
        let parsedPath = (typeof handler === 'function')
          ? handler(relPath, {FIRST_FILE_PATH, block, elem}, relPath)
          : defaultHandler(handler)(FIRST_FILE_PATH, {prefix, block, elem})
        ALL_PREFIXED_TAGS.set(tag, parsedPath)
        result.set(tag, parsedPath)
      }
    })
  })
  return result
}

/**
 * 
 * @param {String} content 
 * @param {Array} prefixes  like [[prefix, path], ...]
 * @return {Map} as [[tag, fullPath]]
 */
const getTagsList = (content, prefixes, relPath) => {
  const tags = new Set()
  HTMLParser(content, {
    start({rawTagName: tag}) {
      if (tag === 'style') return
      if (tag === 'script') HAS_SCRIPT_SECTION = true
      tags.add(tag)
    }
  })
  return sortTagsList(tags, prefixes, relPath)
}

/**
 * 
 * @param {String} content 
 * @param {Array} prefixes  like [[prefix, path], ...]
 * @return {String} 
 */
const makeFileImports = (content, prefixes, relPath) => {
  let imports = '\n'
  const tagsList = getTagsList(content, prefixes, relPath)
  tagsList.forEach((fullPath, tag) => {
    imports += `import ${tag} from "${fullPath}"\n`
  })
  return imports
}

/**
 * 
 * @param {String} content 
 * @param {String} imports 
 */
const putImportsInMarkup = (content, imports) => {
  if (!HAS_SCRIPT_SECTION)
   return content + '<script>' + imports + '</script>'
  return content.replace(/(<script(\s+[^>]*)?>)/, '$1' + imports)
}

/**
 * 
 * @param {Array} prefixes  like [[prefix, path], ...]
 * @return {Function}
 */
const findPrefixTags = (prefixes) => ({content, filename}) => {
  const filePath = path.dirname(filename)
  FIRST_FILE_PATH = FIRST_FILE_PATH || filePath
  HAS_SCRIPT_SECTION = false
  const imports = makeFileImports(content, prefixes, filePath)
  const code = putImportsInMarkup(content, imports)
  return {code}
}

/**
 * 
 * @param {Object} opts like {prefix: path}
 */
const prefixLoader = (prefixes) => {
  if (!prefixes) return {}
  const prefixesEntries = Object.entries(prefixes)
  const markup = findPrefixTags(prefixesEntries)
  return {markup}
}

module.exports = prefixLoader
