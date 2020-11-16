if (process.env.NODE_ENV === 'test') {
  const { BFSRequire, configure } = require('browserfs')
  configure({
    fs: 'InMemory',
    options: {}
  }, () => {})
  module.exports = {
    fs: BFSRequire('fs'),
    path: BFSRequire('path'),
    buffer: BFSRequire('buffer'),
    process: BFSRequire('process'),
    assert: require('assert')
  }
} else {
  const externalModule = __EXTERNAL__

  const pick = (obj, name) => {
    if (!obj) {
      throw new Error('external module is not exist')
    }
    if (!obj[name]) {
      throw new Error(name + ' is not in external module')
    }
    return obj[name]
  }

  module.exports = {
    fs: pick(externalModule, 'fs'),
    path: pick(externalModule, 'path'),
    buffer: pick(externalModule, 'buffer'),
    process: pick(externalModule, 'process'),
    assert: pick(externalModule, 'assert'),
  }
}
