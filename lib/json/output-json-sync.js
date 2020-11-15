'use strict'

const { stringify } = require('./jsonfile')
const { outputFileSync } = require('../output')

function outputJsonSync (file, data, options) {
  const str = stringify(data, options)

  outputFileSync(file, str, options)
}

module.exports = outputJsonSync
