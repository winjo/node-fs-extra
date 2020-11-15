'use strict'

const fse = require(process.cwd() + '/lib')
const ncp = require('../../copy')
const nfs = require('fs')
const path = require('path')
const rimraf = require('rimraf')
const assert = require('assert')
// const readDirFiles = require('read-dir-files').read // temporary, will remove

/* eslint-env mocha */

const fixturesDir = path.join(__dirname, 'fixtures')

const src = path.join(fixturesDir, 'regular-fixtures/src')
fse.ensureDirSync(src)
nfs.readdirSync(src).forEach((f) => {
  const file = path.join(src, f)
  const stat = nfs.statSync(file)
  if (stat.isFile()) {
    fse.writeFileSync(file, nfs.readFileSync(file, 'utf-8'))
  } else {
    fse.ensureDir(file)
    nfs.readdirSync(file).forEach(f => {
      const subFile = path.join(file, f)
      fse.writeFileSync(subFile, nfs.readFileSync(subFile, 'utf-8'))
    })
  }
})

describe('ncp', () => {
  describe('regular files and directories', () => {
    const fixtures = path.join(fixturesDir, 'regular-fixtures')
    const src = path.join(fixtures, 'src')
    const out = path.join(fixtures, 'out')

    before(cb => fse.remove(out, () => ncp(src, out, cb)))

    describe('when copying a directory of files', () => {
      it('files are copied correctly', cb => {
        readDirFiles(src, 'utf8', (srcErr, srcFiles) => {
          readDirFiles(out, 'utf8', (outErr, outFiles) => {
            assert.ifError(srcErr)
            assert.deepStrictEqual(srcFiles, outFiles)
            cb()
          })
        })
      })
    })

    describe('when copying files using filter', () => {
      before(cb => {
        const filter = name => name.substr(name.length - 1) !== 'a'

        fse.remove(out, () => ncp(src, out, { filter }, cb))
      })

      it('files are copied correctly', cb => {
        readDirFiles(src, 'utf8', (srcErr, srcFiles) => {
          function filter (files) {
            for (const fileName in files) {
              const curFile = files[fileName]
              if (curFile instanceof Object) {
                filter(curFile)
              } else if (fileName.substr(fileName.length - 1) === 'a') {
                delete files[fileName]
              }
            }
          }
          filter(srcFiles)
          readDirFiles(out, 'utf8', (outErr, outFiles) => {
            assert.ifError(outErr)
            assert.deepStrictEqual(srcFiles, outFiles)
            cb()
          })
        })
      })
    })

    describe.skip('when using overwrite=true', () => {
      before(function () {
        this.originalCreateReadStream = fs.createReadStream
      })

      after(function () {
        fs.createReadStream = this.originalCreateReadStream
      })

      it('the copy is complete after callback', done => {
        ncp(src, out, { overwrite: true }, err => {
          fs.createReadStream = () => done(new Error('createReadStream after callback'))

          assert.ifError(err)
          process.nextTick(done)
        })
      })
    })

    describe('when using overwrite=false', () => {
      beforeEach(done => fse.remove(out, done))

      it('works', cb => {
        ncp(src, out, { overwrite: false }, err => {
          assert.ifError(err)
          cb()
        })
      })

      it('should not error if files exist', cb => {
        ncp(src, out, () => {
          ncp(src, out, { overwrite: false }, err => {
            assert.ifError(err)
            cb()
          })
        })
      })

      it('should error if errorOnExist and file exists', cb => {
        ncp(src, out, () => {
          ncp(src, out, {
            overwrite: false,
            errorOnExist: true
          }, err => {
            assert(err)
            cb()
          })
        })
      })
    })

    describe('clobber', () => {
      beforeEach(done => fse.remove(out, done))

      it('is an alias for overwrite', cb => {
        ncp(src, out, () => {
          ncp(src, out, {
            clobber: false,
            errorOnExist: true
          }, err => {
            assert(err)
            cb()
          })
        })
      })
    })

    describe.skip('when using transform', () => {
      it('file descriptors are passed correctly', cb => {
        ncp(src, out, {
          transform: (read, write, file) => {
            assert.notStrictEqual(file.name, undefined)
            assert.strictEqual(typeof file.mode, 'number')
            read.pipe(write)
          }
        }, cb)
      })
    })
  })

  // see https://github.com/AvianFlu/ncp/issues/71
  describe('Issue 71: Odd Async Behaviors', () => {
    const fixtures = path.join(__dirname, 'fixtures', 'regular-fixtures')
    const src = path.join(fixtures, 'src')
    const out = path.join(fixtures, 'out')

    let totalCallbacks = 0

    function copyAssertAndCount (callback) {
      // rimraf(out, function() {
      ncp(src, out, err => {
        assert(!err)
        totalCallbacks += 1
        readDirFiles(src, 'utf8', (srcErr, srcFiles) => {
          readDirFiles(out, 'utf8', (outErr, outFiles) => {
            assert.ifError(srcErr)
            assert.deepStrictEqual(srcFiles, outFiles)
            callback()
          })
        })
      })
      // })
    }

    describe('when copying a directory of files without cleaning the destination', () => {
      it('callback fires once per run and directories are equal', done => {
        const expected = 10
        let count = 10

        function next () {
          if (count > 0) {
            setTimeout(() => {
              copyAssertAndCount(() => {
                count -= 1
                next()
              })
            }, 100)
          } else {
            // console.log('Total callback count is', totalCallbacks)
            assert.strictEqual(totalCallbacks, expected)
            done()
          }
        }

        next()
      })
    })
  })
})

var async = require('async'),
    errs = require('errs');

function readDirFiles(dir, encoding, recursive, callback) {
  var result = {}

  callback = arguments[arguments.length - 1];
  typeof callback == "function" || (callback = null);

  if (typeof encoding == "boolean") {
    recursive = encoding;
    encoding = null;
  }
  typeof recursive == "undefined" && (recursive = true);
  typeof encoding == "string" || (encoding = null);

  fse.readdir(dir, function (err, entries) {
    if (err) {
      return errs.handle(err, callback);
    }

    async.forEach(entries, function (entry, next) {
      var entryPath = path.join(dir, entry);
      fse.stat(entryPath, function (err, stat) {
        if (err) {
          return next(err);
        }

        if (stat.isDirectory()) {
          return (recursive || next()) && readDirFiles(
            entryPath, 
            encoding,
            function (err, entries) {
              if (err) {
                return next(err);
              }
              
              result[entry] = entries;
              next();
            }
          );
        }
        fse.readFile(entryPath, encoding, function (err, content) {
          if (err) {
            return next(err);
          }
          
          result[entry] = content;
          next();
        });
      });
    }, function (err) {
      callback && callback(err, result);
    });
  });
};
