'use strict'

// file in reference: https://github.com/jprichardson/node-fs-extra/issues/56

const { fs } = require('../../../external')
const os = require('os')
const fse = require(process.cwd() + '/lib')
const ncp = require('../../copy')
const path = require('path')
const assert = require('assert')

/* global afterEach, beforeEach, describe, it */

// skip test for windows
// eslint-disable globalReturn */
// if (os.platform().indexOf('win') === 0) return
// eslint-enable globalReturn */

describe.skip('ncp / error / dest-permission', () => {
  const TEST_DIR = path.join(os.tmpdir(), 'fs-extra', 'ncp-error-dest-perm')
  const src = path.join(TEST_DIR, 'src')
  const dest = path.join(TEST_DIR, 'dest')

  if (os.platform().indexOf('win') === 0) return

  beforeEach(done => {
    fse.emptyDir(TEST_DIR, err => {
      assert.ifError(err)
      done()
    })
  })

  afterEach(done => fse.remove(TEST_DIR, done))

  it('should return an error', done => {
    const someFile = path.join(src, 'some-file')
    fse.outputFileSync(someFile, 'hello')

    fse.mkdirsSync(dest)
    fs.chmodSync(dest, 0o444)

    const subdest = path.join(dest, 'another-dir')

    ncp(src, subdest, err => {
      assert(err)
      assert.strictEqual(err.code, 'EACCES')
      done()
    })
  })
})
