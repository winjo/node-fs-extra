module.exports = function fsExtraFactory(__EXTERNAL__) {
  var fsExtra = function () {
    'use strict';

    function createCommonjsModule(fn, basedir, module) {
      return module = {
        path: basedir,
        exports: {},
        require: function (path, base) {
          return commonjsRequire(path, base === undefined || base === null ? module.path : base);
        }
      }, fn(module, module.exports), module.exports;
    }

    function commonjsRequire() {
      throw new Error('Dynamic requires are not currently supported by @rollup/plugin-commonjs');
    }

    var fromCallback = function (fn) {
      return Object.defineProperty(function (...args) {
        if (typeof args[args.length - 1] === 'function') fn.apply(this, args);else {
          return new Promise((resolve, reject) => {
            fn.call(this, ...args, (err, res) => err != null ? reject(err) : resolve(res));
          });
        }
      }, 'name', {
        value: fn.name
      });
    };

    var fromPromise = function (fn) {
      return Object.defineProperty(function (...args) {
        const cb = args[args.length - 1];
        if (typeof cb !== 'function') return fn.apply(this, args);else fn.apply(this, args.slice(0, -1)).then(r => cb(null, r), cb);
      }, 'name', {
        value: fn.name
      });
    };

    var universalify = {
      fromCallback: fromCallback,
      fromPromise: fromPromise
    };
    var external = createCommonjsModule(function (module) {
      {
        const externalModule = __EXTERNAL__;

        const pick = (obj, name) => {
          if (!obj) {
            throw new Error('external module is not exist');
          }

          if (!obj[name]) {
            throw new Error(name + ' is not in external module');
          }

          return obj[name];
        };

        module.exports = {
          fs: pick(externalModule, 'fs'),
          path: pick(externalModule, 'path'),
          buffer: pick(externalModule, 'buffer'),
          process: pick(externalModule, 'process'),
          assert: pick(externalModule, 'assert')
        };
      }
    });
    var fs_1 = createCommonjsModule(function (module, exports) {
      // This is adapted from https://github.com/normalize/mz
      // Copyright (c) 2014-2016 Jonathan Ong me@jongleberry.com and Contributors
      const u = universalify.fromCallback;
      const {
        fs
      } = external;
      const api = ['access', 'appendFile', 'chmod', 'chown', 'close', 'copyFile', 'fchmod', 'fchown', 'fdatasync', 'fstat', 'fsync', 'ftruncate', 'futimes', 'lchmod', 'lchown', 'link', 'lstat', 'mkdir', 'mkdtemp', 'open', 'opendir', 'readdir', 'readFile', 'readlink', 'realpath', 'rename', 'rmdir', 'stat', 'symlink', 'truncate', 'unlink', 'utimes', 'writeFile'].filter(key => {
        // Some commands are not available on some systems. Ex:
        // fs.opendir was added in Node.js v12.12.0
        // fs.lchown is not available on at least some Linux
        return typeof fs[key] === 'function';
      }); // Export all keys:

      Object.keys(fs).forEach(key => {
        if (key === 'promises') {
          // fs.promises is a getter property that triggers ExperimentalWarning
          // Don't re-export it here, the getter is defined in "lib/index.js"
          return;
        }

        exports[key] = fs[key];
      }); // Universalify async methods:

      api.forEach(method => {
        exports[method] = u(fs[method]);
      }); // We differ from mz/fs in that we still ship the old, broken, fs.exists()
      // since we are a drop-in replacement for the native module

      exports.exists = function (filename, callback) {
        if (typeof callback === 'function') {
          return fs.exists(filename, callback);
        }

        return new Promise(resolve => {
          return fs.exists(filename, resolve);
        });
      }; // fs.read(), fs.write(), & fs.writev() need special treatment due to multiple callback args


      exports.read = function (fd, buffer, offset, length, position, callback) {
        if (typeof callback === 'function') {
          return fs.read(fd, buffer, offset, length, position, callback);
        }

        return new Promise((resolve, reject) => {
          fs.read(fd, buffer, offset, length, position, (err, bytesRead, buffer) => {
            if (err) return reject(err);
            resolve({
              bytesRead,
              buffer
            });
          });
        });
      }; // Function signature can be
      // fs.write(fd, buffer[, offset[, length[, position]]], callback)
      // OR
      // fs.write(fd, string[, position[, encoding]], callback)
      // We need to handle both cases, so we use ...args


      exports.write = function (fd, buffer, ...args) {
        if (typeof args[args.length - 1] === 'function') {
          return fs.write(fd, buffer, ...args);
        }

        return new Promise((resolve, reject) => {
          fs.write(fd, buffer, ...args, (err, bytesWritten, buffer) => {
            if (err) return reject(err);
            resolve({
              bytesWritten,
              buffer
            });
          });
        });
      }; // fs.writev only available in Node v12.9.0+


      if (typeof fs.writev === 'function') {
        // Function signature is
        // s.writev(fd, buffers[, position], callback)
        // We need to handle the optional arg, so we use ...args
        exports.writev = function (fd, buffers, ...args) {
          if (typeof args[args.length - 1] === 'function') {
            return fs.writev(fd, buffers, ...args);
          }

          return new Promise((resolve, reject) => {
            fs.writev(fd, buffers, ...args, (err, bytesWritten, buffers) => {
              if (err) return reject(err);
              resolve({
                bytesWritten,
                buffers
              });
            });
          });
        };
      } // fs.realpath.native only available in Node v9.2+


      if (typeof fs.realpath.native === 'function') {
        exports.realpath.native = u(fs.realpath.native);
      }
    });
    const {
      path,
      process
    } = external; // https://github.com/nodejs/node/issues/8987
    // https://github.com/libuv/libuv/pull/1088

    const checkPath = pth => {
      if (process.platform === 'win32') {
        const pathHasInvalidWinCharacters = /[<>:"|?*]/.test(pth.replace(path.parse(pth).root, ''));

        if (pathHasInvalidWinCharacters) {
          const error = new Error(`Path contains invalid characters: ${pth}`);
          error.code = 'EINVAL';
          throw error;
        }
      }
    };

    const processOptions = options => {
      const defaults = {
        mode: 0o777
      };
      if (typeof options === 'number') options = {
        mode: options
      };
      return Object.assign({}, defaults, options);
    };

    const permissionError = pth => {
      // This replicates the exception of `fs.mkdir` with native the
      // `recusive` option when run on an invalid drive under Windows.
      const error = new Error(`operation not permitted, mkdir '${pth}'`);
      error.code = 'EPERM';
      error.errno = -4048;
      error.path = pth;
      error.syscall = 'mkdir';
      return error;
    };

    var makeDir_1 = async (input, options) => {
      checkPath(input);
      options = processOptions(options);

      const make = async pth => {
        try {
          await fs_1.mkdir(pth, options.mode);
        } catch (error) {
          if (error.code === 'EPERM') {
            throw error;
          }

          if (error.code === 'ENOENT') {
            if (path.dirname(pth) === pth) {
              throw permissionError(pth);
            }

            if (error.message.includes('null bytes')) {
              throw error;
            }

            await make(path.dirname(pth));
            return make(pth);
          }

          try {
            const stats = await fs_1.stat(pth);

            if (!stats.isDirectory()) {
              // This error is never exposed to the user
              // it is caught below, and the original error is thrown
              throw new Error('The path is not a directory');
            }
          } catch (err) {
            throw error;
          }
        }
      };

      return make(path.resolve(input));
    };

    var makeDirSync = (input, options) => {
      checkPath(input);
      options = processOptions(options);

      const make = pth => {
        try {
          fs_1.mkdirSync(pth, options.mode);
        } catch (error) {
          if (error.code === 'EPERM') {
            throw error;
          }

          if (error.code === 'ENOENT') {
            if (path.dirname(pth) === pth) {
              throw permissionError(pth);
            }

            if (error.message.includes('null bytes')) {
              throw error;
            }

            make(path.dirname(pth));
            return make(pth);
          }

          try {
            if (!fs_1.statSync(pth).isDirectory()) {
              // This error is never exposed to the user
              // it is caught below, and the original error is thrown
              throw new Error('The path is not a directory');
            }
          } catch (err) {
            throw error;
          }
        }
      };

      return make(path.resolve(input));
    };

    var makeDir = {
      makeDir: makeDir_1,
      makeDirSync: makeDirSync
    };
    const u = universalify.fromPromise;
    const {
      makeDir: _makeDir,
      makeDirSync: makeDirSync$1
    } = makeDir;
    const makeDir$1 = u(_makeDir);
    var mkdirs = {
      mkdirs: makeDir$1,
      mkdirsSync: makeDirSync$1,
      // alias
      mkdirp: makeDir$1,
      mkdirpSync: makeDirSync$1,
      ensureDir: makeDir$1,
      ensureDirSync: makeDirSync$1
    };
    const {
      path: path$1
    } = external;
    const u$1 = universalify.fromPromise;

    const stat = file => fs_1.stat(file);

    const statSync = file => fs_1.statSync(file);

    function getStats(src, dest) {
      return Promise.all([stat(src), stat(dest).catch(err => {
        if (err.code === 'ENOENT') return null;
        throw err;
      })]).then(([srcStat, destStat]) => ({
        srcStat,
        destStat
      }));
    }

    function getStatsSync(src, dest) {
      let destStat;
      const srcStat = statSync(src);

      try {
        destStat = statSync(dest);
      } catch (err) {
        if (err.code === 'ENOENT') return {
          srcStat,
          destStat: null
        };
        throw err;
      }

      return {
        srcStat,
        destStat
      };
    }

    function checkPaths(src, dest, funcName, cb) {
      u$1(getStats)(src, dest, (err, stats) => {
        if (err) return cb(err);
        const {
          srcStat,
          destStat
        } = stats;

        if (destStat && areIdentical(srcStat, destStat)) {
          return cb(new Error('Source and destination must not be the same.'));
        }

        if (srcStat.isDirectory() && isSrcSubdir(src, dest)) {
          return cb(new Error(errMsg(src, dest, funcName)));
        }

        return cb(null, {
          srcStat,
          destStat
        });
      });
    }

    function checkPathsSync(src, dest, funcName) {
      const {
        srcStat,
        destStat
      } = getStatsSync(src, dest);

      if (destStat && areIdentical(srcStat, destStat)) {
        throw new Error('Source and destination must not be the same.');
      }

      if (srcStat.isDirectory() && isSrcSubdir(src, dest)) {
        throw new Error(errMsg(src, dest, funcName));
      }

      return {
        srcStat,
        destStat
      };
    } // recursively check if dest parent is a subdirectory of src.
    // It works for all file types including symlinks since it
    // checks the src and dest inodes. It starts from the deepest
    // parent and stops once it reaches the src parent or the root path.


    function checkParentPaths(src, srcStat, dest, funcName, cb) {
      const srcParent = path$1.resolve(path$1.dirname(src));
      const destParent = path$1.resolve(path$1.dirname(dest));
      if (destParent === srcParent || destParent === path$1.parse(destParent).root) return cb();

      const callback = (err, destStat) => {
        if (err) {
          if (err.code === 'ENOENT') return cb();
          return cb(err);
        }

        if (areIdentical(srcStat, destStat)) {
          return cb(new Error(errMsg(src, dest, funcName)));
        }

        return checkParentPaths(src, srcStat, destParent, funcName, cb);
      };

      fs_1.stat(destParent, callback);
    }

    function checkParentPathsSync(src, srcStat, dest, funcName) {
      const srcParent = path$1.resolve(path$1.dirname(src));
      const destParent = path$1.resolve(path$1.dirname(dest));
      if (destParent === srcParent || destParent === path$1.parse(destParent).root) return;
      let destStat;

      try {
        destStat = statSync(destParent);
      } catch (err) {
        if (err.code === 'ENOENT') return;
        throw err;
      }

      if (areIdentical(srcStat, destStat)) {
        throw new Error(errMsg(src, dest, funcName));
      }

      return checkParentPathsSync(src, srcStat, destParent, funcName);
    }

    function areIdentical(srcStat, destStat) {
      if (destStat.ino && destStat.dev && destStat.ino === srcStat.ino && destStat.dev === srcStat.dev) {
        if (destStat.ino < Number.MAX_SAFE_INTEGER) {
          // definitive answer
          return true;
        } // Use additional heuristics if we can't use 'bigint'.
        // Different 'ino' could be represented the same if they are >= Number.MAX_SAFE_INTEGER
        // See issue 657


        if (destStat.size === srcStat.size && destStat.mode === srcStat.mode && destStat.nlink === srcStat.nlink && destStat.atimeMs === srcStat.atimeMs && destStat.mtimeMs === srcStat.mtimeMs && destStat.ctimeMs === srcStat.ctimeMs && destStat.birthtimeMs === srcStat.birthtimeMs) {
          // heuristic answer
          return true;
        }
      }

      return false;
    } // return true if dest is a subdir of src, otherwise false.
    // It only checks the path strings.


    function isSrcSubdir(src, dest) {
      const srcArr = path$1.resolve(src).split(path$1.sep).filter(i => i);
      const destArr = path$1.resolve(dest).split(path$1.sep).filter(i => i);
      return srcArr.reduce((acc, cur, i) => acc && destArr[i] === cur, true);
    }

    function errMsg(src, dest, funcName) {
      return `Cannot ${funcName} '${src}' to a subdirectory of itself, '${dest}'.`;
    }

    var stat_1 = {
      checkPaths,
      checkPathsSync,
      checkParentPaths,
      checkParentPathsSync,
      isSrcSubdir
    };
    const {
      fs,
      path: path$2,
      process: process$1
    } = external;
    const mkdirsSync = mkdirs.mkdirsSync;

    function copySync(src, dest, opts) {
      if (typeof opts === 'function') {
        opts = {
          filter: opts
        };
      }

      opts = opts || {};
      opts.clobber = 'clobber' in opts ? !!opts.clobber : true; // default to true for now

      opts.overwrite = 'overwrite' in opts ? !!opts.overwrite : opts.clobber; // overwrite falls back to clobber
      // Warn about using preserveTimestamps on 32-bit node

      if (opts.preserveTimestamps && process$1.arch === 'ia32') {
        console.warn(`fs-extra: Using the preserveTimestamps option in 32-bit node is not recommended;\n
    see https://github.com/jprichardson/node-fs-extra/issues/269`);
      }

      const {
        srcStat,
        destStat
      } = stat_1.checkPathsSync(src, dest, 'copy');
      stat_1.checkParentPathsSync(src, srcStat, dest, 'copy');
      return handleFilterAndCopy(destStat, src, dest, opts);
    }

    function handleFilterAndCopy(destStat, src, dest, opts) {
      if (opts.filter && !opts.filter(src, dest)) return;
      const destParent = path$2.dirname(dest);
      if (!fs.existsSync(destParent)) mkdirsSync(destParent);
      return startCopy(destStat, src, dest, opts);
    }

    function startCopy(destStat, src, dest, opts) {
      if (opts.filter && !opts.filter(src, dest)) return;
      return getStats$1(destStat, src, dest, opts);
    }

    function getStats$1(destStat, src, dest, opts) {
      const statSync = opts.dereference ? fs.statSync : fs.lstatSync;
      const srcStat = statSync(src);
      if (srcStat.isDirectory()) return onDir(srcStat, destStat, src, dest, opts);else if (srcStat.isFile() || srcStat.isCharacterDevice() || srcStat.isBlockDevice()) return onFile(srcStat, destStat, src, dest, opts);else if (srcStat.isSymbolicLink()) return onLink(destStat, src, dest, opts);
    }

    function onFile(srcStat, destStat, src, dest, opts) {
      if (!destStat) return copyFile(srcStat, src, dest);
      return mayCopyFile(srcStat, src, dest, opts);
    }

    function mayCopyFile(srcStat, src, dest, opts) {
      if (opts.overwrite) {
        fs.unlinkSync(dest);
        return copyFile(srcStat, src, dest);
      } else if (opts.errorOnExist) {
        throw new Error(`'${dest}' already exists`);
      }
    }

    function copyFile(srcStat, src, dest, opts) {
      // fs.copyFileSync(src, dest)
      fs.writeFileSync(dest, fs.readFileSync(src), {
        encoding: null
      }); // if (opts.preserveTimestamps) handleTimestamps(srcStat.mode, src, dest)

      return setDestMode(dest, srcStat.mode);
    }

    function setDestMode(dest, srcMode) {// return fs.chmodSync(dest, srcMode)
    }

    function onDir(srcStat, destStat, src, dest, opts) {
      if (!destStat) return mkDirAndCopy(srcStat.mode, src, dest, opts);

      if (destStat && !destStat.isDirectory()) {
        throw new Error(`Cannot overwrite non-directory '${dest}' with directory '${src}'.`);
      }

      return copyDir(src, dest, opts);
    }

    function mkDirAndCopy(srcMode, src, dest, opts) {
      fs.mkdirSync(dest);
      copyDir(src, dest, opts);
      return setDestMode();
    }

    function copyDir(src, dest, opts) {
      fs.readdirSync(src).forEach(item => copyDirItem(item, src, dest, opts));
    }

    function copyDirItem(item, src, dest, opts) {
      const srcItem = path$2.join(src, item);
      const destItem = path$2.join(dest, item);
      const {
        destStat
      } = stat_1.checkPathsSync(srcItem, destItem, 'copy');
      return startCopy(destStat, srcItem, destItem, opts);
    }

    function onLink(destStat, src, dest, opts) {
      let resolvedSrc = fs.readlinkSync(src);

      if (opts.dereference) {
        resolvedSrc = path$2.resolve(process$1.cwd(), resolvedSrc);
      }

      if (!destStat) {
        return fs.symlinkSync(resolvedSrc, dest);
      } else {
        let resolvedDest;

        try {
          resolvedDest = fs.readlinkSync(dest);
        } catch (err) {
          // dest exists and is a regular file or directory,
          // Windows may throw UNKNOWN error. If dest already exists,
          // fs throws error anyway, so no need to guard against it here.
          if (err.code === 'EINVAL' || err.code === 'UNKNOWN') return fs.symlinkSync(resolvedSrc, dest);
          throw err;
        }

        if (opts.dereference) {
          resolvedDest = path$2.resolve(process$1.cwd(), resolvedDest);
        }

        if (stat_1.isSrcSubdir(resolvedSrc, resolvedDest)) {
          throw new Error(`Cannot copy '${resolvedSrc}' to a subdirectory of itself, '${resolvedDest}'.`);
        } // prevent copy if src is a subdir of dest since unlinking
        // dest in this case would result in removing src contents
        // and therefore a broken symlink would be created.


        if (fs.statSync(dest).isDirectory() && stat_1.isSrcSubdir(resolvedDest, resolvedSrc)) {
          throw new Error(`Cannot overwrite '${resolvedDest}' with '${resolvedSrc}'.`);
        }

        return copyLink(resolvedSrc, dest);
      }
    }

    function copyLink(resolvedSrc, dest) {
      fs.unlinkSync(dest);
      return fs.symlinkSync(resolvedSrc, dest);
    }

    var copySync_1 = copySync;
    var copySync$1 = {
      copySync: copySync_1
    };
    const u$2 = universalify.fromPromise;

    function pathExists(path) {
      // return fs.access(path).then(() => true).catch(() => false)
      return fs_1.exists(path).then(exists => exists);
    }

    var pathExists_1 = {
      pathExists: u$2(pathExists),
      pathExistsSync: fs_1.existsSync
    };
    const {
      fs: fs$1,
      path: path$3,
      process: process$2
    } = external;
    const mkdirs$1 = mkdirs.mkdirs;
    const pathExists$1 = pathExists_1.pathExists;

    function copy(src, dest, opts, cb) {
      if (typeof opts === 'function' && !cb) {
        cb = opts;
        opts = {};
      } else if (typeof opts === 'function') {
        opts = {
          filter: opts
        };
      }

      cb = cb || function () {};

      opts = opts || {};
      opts.clobber = 'clobber' in opts ? !!opts.clobber : true; // default to true for now

      opts.overwrite = 'overwrite' in opts ? !!opts.overwrite : opts.clobber; // overwrite falls back to clobber
      // Warn about using preserveTimestamps on 32-bit node

      if (opts.preserveTimestamps && process$2.arch === 'ia32') {
        console.warn(`fs-extra: Using the preserveTimestamps option in 32-bit node is not recommended;\n
    see https://github.com/jprichardson/node-fs-extra/issues/269`);
      }

      stat_1.checkPaths(src, dest, 'copy', (err, stats) => {
        if (err) return cb(err);
        const {
          srcStat,
          destStat
        } = stats;
        stat_1.checkParentPaths(src, srcStat, dest, 'copy', err => {
          if (err) return cb(err);
          if (opts.filter) return handleFilter(checkParentDir, destStat, src, dest, opts, cb);
          return checkParentDir(destStat, src, dest, opts, cb);
        });
      });
    }

    function checkParentDir(destStat, src, dest, opts, cb) {
      const destParent = path$3.dirname(dest);
      pathExists$1(destParent, (err, dirExists) => {
        if (err) return cb(err);
        if (dirExists) return startCopy$1(destStat, src, dest, opts, cb);
        mkdirs$1(destParent, err => {
          if (err) return cb(err);
          return startCopy$1(destStat, src, dest, opts, cb);
        });
      });
    }

    function handleFilter(onInclude, destStat, src, dest, opts, cb) {
      Promise.resolve(opts.filter(src, dest)).then(include => {
        if (include) return onInclude(destStat, src, dest, opts, cb);
        return cb();
      }, error => cb(error));
    }

    function startCopy$1(destStat, src, dest, opts, cb) {
      if (opts.filter) return handleFilter(getStats$2, destStat, src, dest, opts, cb);
      return getStats$2(destStat, src, dest, opts, cb);
    }

    function getStats$2(destStat, src, dest, opts, cb) {
      const stat = opts.dereference ? fs$1.stat : fs$1.lstat;
      stat(src, (err, srcStat) => {
        if (err) return cb(err);
        if (srcStat.isDirectory()) return onDir$1(srcStat, destStat, src, dest, opts, cb);else if (srcStat.isFile() || srcStat.isCharacterDevice() || srcStat.isBlockDevice()) return onFile$1(srcStat, destStat, src, dest, opts, cb);else if (srcStat.isSymbolicLink()) return onLink$1(destStat, src, dest, opts, cb);
      });
    }

    function onFile$1(srcStat, destStat, src, dest, opts, cb) {
      if (!destStat) return copyFile$1(srcStat, src, dest, opts, cb);
      return mayCopyFile$1(srcStat, src, dest, opts, cb);
    }

    function mayCopyFile$1(srcStat, src, dest, opts, cb) {
      if (opts.overwrite) {
        fs$1.unlink(dest, err => {
          if (err) return cb(err);
          return copyFile$1(srcStat, src, dest, opts, cb);
        });
      } else if (opts.errorOnExist) {
        return cb(new Error(`'${dest}' already exists`));
      } else return cb();
    }

    function copyFile$1(srcStat, src, dest, opts, cb) {
      // fs.copyFile(src, dest, err => {
      //   if (err) return cb(err)
      //   if (opts.preserveTimestamps) return handleTimestampsAndMode(srcStat.mode, src, dest, cb)
      //   return setDestMode(dest, srcStat.mode, cb)
      // })
      fs$1.readFile(src, (err, data) => {
        if (err) return cb(err);
        fs$1.writeFile(dest, data, {
          encoding: null
        }, err => {
          if (err) return cb(err);
          cb();
        });
      });
    }

    function setDestMode$1(dest, srcMode, cb) {
      // not support chmod
      // return fs.chmod(dest, srcMode, cb)
      cb();
    }

    function onDir$1(srcStat, destStat, src, dest, opts, cb) {
      if (!destStat) return mkDirAndCopy$1(srcStat.mode, src, dest, opts, cb);

      if (destStat && !destStat.isDirectory()) {
        return cb(new Error(`Cannot overwrite non-directory '${dest}' with directory '${src}'.`));
      }

      return copyDir$1(src, dest, opts, cb);
    }

    function mkDirAndCopy$1(srcMode, src, dest, opts, cb) {
      fs$1.mkdir(dest, err => {
        if (err) return cb(err);
        copyDir$1(src, dest, opts, err => {
          if (err) return cb(err);
          return setDestMode$1(dest, srcMode, cb);
        });
      });
    }

    function copyDir$1(src, dest, opts, cb) {
      fs$1.readdir(src, (err, items) => {
        if (err) return cb(err);
        return copyDirItems(items, src, dest, opts, cb);
      });
    }

    function copyDirItems(items, src, dest, opts, cb) {
      const item = items.pop();
      if (!item) return cb();
      return copyDirItem$1(items, item, src, dest, opts, cb);
    }

    function copyDirItem$1(items, item, src, dest, opts, cb) {
      const srcItem = path$3.join(src, item);
      const destItem = path$3.join(dest, item);
      stat_1.checkPaths(srcItem, destItem, 'copy', (err, stats) => {
        if (err) return cb(err);
        const {
          destStat
        } = stats;
        startCopy$1(destStat, srcItem, destItem, opts, err => {
          if (err) return cb(err);
          return copyDirItems(items, src, dest, opts, cb);
        });
      });
    }

    function onLink$1(destStat, src, dest, opts, cb) {
      fs$1.readlink(src, (err, resolvedSrc) => {
        if (err) return cb(err);

        if (opts.dereference) {
          resolvedSrc = path$3.resolve(process$2.cwd(), resolvedSrc);
        }

        if (!destStat) {
          return fs$1.symlink(resolvedSrc, dest, cb);
        } else {
          fs$1.readlink(dest, (err, resolvedDest) => {
            if (err) {
              // dest exists and is a regular file or directory,
              // Windows may throw UNKNOWN error. If dest already exists,
              // fs throws error anyway, so no need to guard against it here.
              if (err.code === 'EINVAL' || err.code === 'UNKNOWN') return fs$1.symlink(resolvedSrc, dest, cb);
              return cb(err);
            }

            if (opts.dereference) {
              resolvedDest = path$3.resolve(process$2.cwd(), resolvedDest);
            }

            if (stat_1.isSrcSubdir(resolvedSrc, resolvedDest)) {
              return cb(new Error(`Cannot copy '${resolvedSrc}' to a subdirectory of itself, '${resolvedDest}'.`));
            } // do not copy if src is a subdir of dest since unlinking
            // dest in this case would result in removing src contents
            // and therefore a broken symlink would be created.


            if (destStat.isDirectory() && stat_1.isSrcSubdir(resolvedDest, resolvedSrc)) {
              return cb(new Error(`Cannot overwrite '${resolvedDest}' with '${resolvedSrc}'.`));
            }

            return copyLink$1(resolvedSrc, dest, cb);
          });
        }
      });
    }

    function copyLink$1(resolvedSrc, dest, cb) {
      fs$1.unlink(dest, err => {
        if (err) return cb(err);
        return fs$1.symlink(resolvedSrc, dest, cb);
      });
    }

    var copy_1 = copy;
    const u$3 = universalify.fromCallback;
    var copy$1 = {
      copy: u$3(copy_1)
    };
    const {
      fs: fs$2,
      path: path$4,
      assert,
      process: process$3
    } = external;
    const isWindows = process$3.platform === 'win32';

    function defaults(options) {
      const methods = ['unlink', 'chmod', 'stat', 'lstat', 'rmdir', 'readdir'];
      methods.forEach(m => {
        options[m] = options[m] || fs$2[m];
        m = m + 'Sync';
        options[m] = options[m] || fs$2[m];
      });
      options.maxBusyTries = options.maxBusyTries || 3;
    }

    function rimraf(p, options, cb) {
      let busyTries = 0;

      if (typeof options === 'function') {
        cb = options;
        options = {};
      }

      assert(p, 'rimraf: missing path');
      assert.strictEqual(typeof p, 'string', 'rimraf: path should be a string');
      assert.strictEqual(typeof cb, 'function', 'rimraf: callback function required');
      assert(options, 'rimraf: invalid options argument provided');
      assert.strictEqual(typeof options, 'object', 'rimraf: options should be object');
      defaults(options);
      rimraf_(p, options, function CB(er) {
        if (er) {
          if ((er.code === 'EBUSY' || er.code === 'ENOTEMPTY' || er.code === 'EPERM') && busyTries < options.maxBusyTries) {
            busyTries++;
            const time = busyTries * 100; // try again, with the same exact callback as this one.

            return setTimeout(() => rimraf_(p, options, CB), time);
          } // already gone


          if (er.code === 'ENOENT') er = null;
        }

        cb(er);
      });
    } // Two possible strategies.
    // 1. Assume it's a file.  unlink it, then do the dir stuff on EPERM or EISDIR
    // 2. Assume it's a directory.  readdir, then do the file stuff on ENOTDIR
    //
    // Both result in an extra syscall when you guess wrong.  However, there
    // are likely far more normal files in the world than directories.  This
    // is based on the assumption that a the average number of files per
    // directory is >= 1.
    //
    // If anyone ever complains about this, then I guess the strategy could
    // be made configurable somehow.  But until then, YAGNI.


    function rimraf_(p, options, cb) {
      assert(p);
      assert(options);
      assert(typeof cb === 'function'); // sunos lets the root user unlink directories, which is... weird.
      // so we have to lstat here and make sure it's not a dir.

      options.lstat(p, (er, st) => {
        if (er && er.code === 'ENOENT') {
          return cb(null);
        } // Windows can EPERM on stat.  Life is suffering.


        if (er && er.code === 'EPERM' && isWindows) {
          return fixWinEPERM(p, options, er, cb);
        }

        if (st && st.isDirectory()) {
          return rmdir(p, options, er, cb);
        }

        options.unlink(p, er => {
          if (er) {
            if (er.code === 'ENOENT') {
              return cb(null);
            }

            if (er.code === 'EPERM') {
              return isWindows ? fixWinEPERM(p, options, er, cb) : rmdir(p, options, er, cb);
            }

            if (er.code === 'EISDIR') {
              return rmdir(p, options, er, cb);
            }
          }

          return cb(er);
        });
      });
    }

    function fixWinEPERM(p, options, er, cb) {
      assert(p);
      assert(options);
      assert(typeof cb === 'function');
      options.chmod(p, 0o666, er2 => {
        if (er2) {
          cb(er2.code === 'ENOENT' ? null : er);
        } else {
          options.stat(p, (er3, stats) => {
            if (er3) {
              cb(er3.code === 'ENOENT' ? null : er);
            } else if (stats.isDirectory()) {
              rmdir(p, options, er, cb);
            } else {
              options.unlink(p, cb);
            }
          });
        }
      });
    }

    function fixWinEPERMSync(p, options, er) {
      let stats;
      assert(p);
      assert(options);

      try {
        options.chmodSync(p, 0o666);
      } catch (er2) {
        if (er2.code === 'ENOENT') {
          return;
        } else {
          throw er;
        }
      }

      try {
        stats = options.statSync(p);
      } catch (er3) {
        if (er3.code === 'ENOENT') {
          return;
        } else {
          throw er;
        }
      }

      if (stats.isDirectory()) {
        rmdirSync(p, options, er);
      } else {
        options.unlinkSync(p);
      }
    }

    function rmdir(p, options, originalEr, cb) {
      assert(p);
      assert(options);
      assert(typeof cb === 'function'); // try to rmdir first, and only readdir on ENOTEMPTY or EEXIST (SunOS)
      // if we guessed wrong, and it's not a directory, then
      // raise the original error.

      options.rmdir(p, er => {
        if (er && (er.code === 'ENOTEMPTY' || er.code === 'EEXIST' || er.code === 'EPERM')) {
          rmkids(p, options, cb);
        } else if (er && er.code === 'ENOTDIR') {
          cb(originalEr);
        } else {
          cb(er);
        }
      });
    }

    function rmkids(p, options, cb) {
      assert(p);
      assert(options);
      assert(typeof cb === 'function');
      options.readdir(p, (er, files) => {
        if (er) return cb(er);
        let n = files.length;
        let errState;
        if (n === 0) return options.rmdir(p, cb);
        files.forEach(f => {
          rimraf(path$4.join(p, f), options, er => {
            if (errState) {
              return;
            }

            if (er) return cb(errState = er);

            if (--n === 0) {
              options.rmdir(p, cb);
            }
          });
        });
      });
    } // this looks simpler, and is strictly *faster*, but will
    // tie up the JavaScript thread and fail on excessively
    // deep directory trees.


    function rimrafSync(p, options) {
      let st;
      options = options || {};
      defaults(options);
      assert(p, 'rimraf: missing path');
      assert.strictEqual(typeof p, 'string', 'rimraf: path should be a string');
      assert(options, 'rimraf: missing options');
      assert.strictEqual(typeof options, 'object', 'rimraf: options should be object');

      try {
        st = options.lstatSync(p);
      } catch (er) {
        if (er.code === 'ENOENT') {
          return;
        } // Windows can EPERM on stat.  Life is suffering.


        if (er.code === 'EPERM' && isWindows) {
          fixWinEPERMSync(p, options, er);
        }
      }

      try {
        // sunos lets the root user unlink directories, which is... weird.
        if (st && st.isDirectory()) {
          rmdirSync(p, options, null);
        } else {
          options.unlinkSync(p);
        }
      } catch (er) {
        if (er.code === 'ENOENT') {
          return;
        } else if (er.code === 'EPERM') {
          return isWindows ? fixWinEPERMSync(p, options, er) : rmdirSync(p, options, er);
        } else if (er.code !== 'EISDIR') {
          throw er;
        }

        rmdirSync(p, options, er);
      }
    }

    function rmdirSync(p, options, originalEr) {
      assert(p);
      assert(options);

      try {
        options.rmdirSync(p);
      } catch (er) {
        if (er.code === 'ENOTDIR') {
          throw originalEr;
        } else if (er.code === 'ENOTEMPTY' || er.code === 'EEXIST' || er.code === 'EPERM') {
          rmkidsSync(p, options);
        } else if (er.code !== 'ENOENT') {
          throw er;
        }
      }
    }

    function rmkidsSync(p, options) {
      assert(p);
      assert(options);
      options.readdirSync(p).forEach(f => rimrafSync(path$4.join(p, f), options));

      if (isWindows) {
        // We only end up here once we got ENOTEMPTY at least once, and
        // at this point, we are guaranteed to have removed all the kids.
        // So, we know that it won't be ENOENT or ENOTDIR or anything else.
        // try really hard to delete stuff on windows, because it has a
        // PROFOUNDLY annoying habit of not closing handles promptly when
        // files are deleted, resulting in spurious ENOTEMPTY errors.
        const startTime = Date.now();

        do {
          try {
            const ret = options.rmdirSync(p, options);
            return ret;
          } catch (err) {}
        } while (Date.now() - startTime < 500); // give up after 500ms

      } else {
        const ret = options.rmdirSync(p, options);
        return ret;
      }
    }

    var rimraf_1 = rimraf;
    rimraf.sync = rimrafSync;
    const u$4 = universalify.fromCallback;
    var remove = {
      remove: u$4(rimraf_1),
      removeSync: rimraf_1.sync
    };
    const u$5 = universalify.fromCallback;
    const {
      fs: fs$3,
      path: path$5
    } = external;
    const emptyDir = u$5(function emptyDir(dir, callback) {
      callback = callback || function () {};

      fs$3.readdir(dir, (err, items) => {
        if (err) return mkdirs.mkdirs(dir, callback);
        items = items.map(item => path$5.join(dir, item));
        deleteItem();

        function deleteItem() {
          const item = items.pop();
          if (!item) return callback();
          remove.remove(item, err => {
            if (err) return callback(err);
            deleteItem();
          });
        }
      });
    });

    function emptyDirSync(dir) {
      let items;

      try {
        items = fs$3.readdirSync(dir);
      } catch (err) {
        return mkdirs.mkdirsSync(dir);
      }

      items.forEach(item => {
        item = path$5.join(dir, item);
        remove.removeSync(item);
      });
    }

    var empty = {
      emptyDirSync,
      emptydirSync: emptyDirSync,
      emptyDir,
      emptydir: emptyDir
    };
    const u$6 = universalify.fromCallback;
    const {
      fs: fs$4,
      path: path$6
    } = external;

    function createFile(file, callback) {
      function makeFile() {
        fs$4.writeFile(file, '', err => {
          if (err) return callback(err);
          callback();
        });
      }

      fs$4.stat(file, (err, stats) => {
        // eslint-disable-line handle-callback-err
        if (!err && stats.isFile()) return callback();
        const dir = path$6.dirname(file);
        fs$4.stat(dir, (err, stats) => {
          if (err) {
            // if the directory doesn't exist, make it
            if (err.code === 'ENOENT') {
              return mkdirs.mkdirs(dir, err => {
                if (err) return callback(err);
                makeFile();
              });
            }

            return callback(err);
          }

          if (stats.isDirectory()) makeFile();else {
            // parent is not a directory
            // This is just to cause an internal ENOTDIR error to be thrown
            fs$4.readdir(dir, err => {
              if (err) return callback(err);
            });
          }
        });
      });
    }

    function createFileSync(file) {
      let stats;

      try {
        stats = fs$4.statSync(file);
      } catch (err) {}

      if (stats && stats.isFile()) return;
      const dir = path$6.dirname(file);

      try {
        if (!fs$4.statSync(dir).isDirectory()) {
          // parent is not a directory
          // This is just to cause an internal ENOTDIR error to be thrown
          fs$4.readdirSync(dir);
        }
      } catch (err) {
        // If the stat call above failed because the directory doesn't exist, create it
        if (err && err.code === 'ENOENT') mkdirs.mkdirsSync(dir);else throw err;
      }

      fs$4.writeFileSync(file, '');
    }

    var file = {
      createFile: u$6(createFile),
      createFileSync
    };
    const u$7 = universalify.fromCallback;
    const {
      fs: fs$5,
      path: path$7
    } = external;
    const pathExists$2 = pathExists_1.pathExists;

    function createLink(srcpath, dstpath, callback) {
      function makeLink(srcpath, dstpath) {
        fs$5.link(srcpath, dstpath, err => {
          if (err) return callback(err);
          callback(null);
        });
      }

      pathExists$2(dstpath, (err, destinationExists) => {
        if (err) return callback(err);
        if (destinationExists) return callback(null);
        fs$5.lstat(srcpath, err => {
          if (err) {
            err.message = err.message.replace('lstat', 'ensureLink');
            return callback(err);
          }

          const dir = path$7.dirname(dstpath);
          pathExists$2(dir, (err, dirExists) => {
            if (err) return callback(err);
            if (dirExists) return makeLink(srcpath, dstpath);
            mkdirs.mkdirs(dir, err => {
              if (err) return callback(err);
              makeLink(srcpath, dstpath);
            });
          });
        });
      });
    }

    function createLinkSync(srcpath, dstpath) {
      const destinationExists = fs$5.existsSync(dstpath);
      if (destinationExists) return undefined;

      try {
        fs$5.lstatSync(srcpath);
      } catch (err) {
        err.message = err.message.replace('lstat', 'ensureLink');
        throw err;
      }

      const dir = path$7.dirname(dstpath);
      const dirExists = fs$5.existsSync(dir);
      if (dirExists) return fs$5.linkSync(srcpath, dstpath);
      mkdirs.mkdirsSync(dir);
      return fs$5.linkSync(srcpath, dstpath);
    }

    var link = {
      createLink: u$7(createLink),
      createLinkSync
    };
    const {
      fs: fs$6,
      path: path$8
    } = external;
    const pathExists$3 = pathExists_1.pathExists;
    /**
     * Function that returns two types of paths, one relative to symlink, and one
     * relative to the current working directory. Checks if path is absolute or
     * relative. If the path is relative, this function checks if the path is
     * relative to symlink or relative to current working directory. This is an
     * initiative to find a smarter `srcpath` to supply when building symlinks.
     * This allows you to determine which path to use out of one of three possible
     * types of source paths. The first is an absolute path. This is detected by
     * `path.isAbsolute()`. When an absolute path is provided, it is checked to
     * see if it exists. If it does it's used, if not an error is returned
     * (callback)/ thrown (sync). The other two options for `srcpath` are a
     * relative url. By default Node's `fs.symlink` works by creating a symlink
     * using `dstpath` and expects the `srcpath` to be relative to the newly
     * created symlink. If you provide a `srcpath` that does not exist on the file
     * system it results in a broken symlink. To minimize this, the function
     * checks to see if the 'relative to symlink' source file exists, and if it
     * does it will use it. If it does not, it checks if there's a file that
     * exists that is relative to the current working directory, if does its used.
     * This preserves the expectations of the original fs.symlink spec and adds
     * the ability to pass in `relative to current working direcotry` paths.
     */

    function symlinkPaths(srcpath, dstpath, callback) {
      if (path$8.isAbsolute(srcpath)) {
        return fs$6.lstat(srcpath, err => {
          if (err) {
            err.message = err.message.replace('lstat', 'ensureSymlink');
            return callback(err);
          }

          return callback(null, {
            toCwd: srcpath,
            toDst: srcpath
          });
        });
      } else {
        const dstdir = path$8.dirname(dstpath);
        const relativeToDst = path$8.join(dstdir, srcpath);
        return pathExists$3(relativeToDst, (err, exists) => {
          if (err) return callback(err);

          if (exists) {
            return callback(null, {
              toCwd: relativeToDst,
              toDst: srcpath
            });
          } else {
            return fs$6.lstat(srcpath, err => {
              if (err) {
                err.message = err.message.replace('lstat', 'ensureSymlink');
                return callback(err);
              }

              return callback(null, {
                toCwd: srcpath,
                toDst: path$8.relative(dstdir, srcpath)
              });
            });
          }
        });
      }
    }

    function symlinkPathsSync(srcpath, dstpath) {
      let exists;

      if (path$8.isAbsolute(srcpath)) {
        exists = fs$6.existsSync(srcpath);
        if (!exists) throw new Error('absolute srcpath does not exist');
        return {
          toCwd: srcpath,
          toDst: srcpath
        };
      } else {
        const dstdir = path$8.dirname(dstpath);
        const relativeToDst = path$8.join(dstdir, srcpath);
        exists = fs$6.existsSync(relativeToDst);

        if (exists) {
          return {
            toCwd: relativeToDst,
            toDst: srcpath
          };
        } else {
          exists = fs$6.existsSync(srcpath);
          if (!exists) throw new Error('relative srcpath does not exist');
          return {
            toCwd: srcpath,
            toDst: path$8.relative(dstdir, srcpath)
          };
        }
      }
    }

    var symlinkPaths_1 = {
      symlinkPaths,
      symlinkPathsSync
    };
    const {
      fs: fs$7
    } = external;

    function symlinkType(srcpath, type, callback) {
      callback = typeof type === 'function' ? type : callback;
      type = typeof type === 'function' ? false : type;
      if (type) return callback(null, type);
      fs$7.lstat(srcpath, (err, stats) => {
        if (err) return callback(null, 'file');
        type = stats && stats.isDirectory() ? 'dir' : 'file';
        callback(null, type);
      });
    }

    function symlinkTypeSync(srcpath, type) {
      let stats;
      if (type) return type;

      try {
        stats = fs$7.lstatSync(srcpath);
      } catch (err) {
        return 'file';
      }

      return stats && stats.isDirectory() ? 'dir' : 'file';
    }

    var symlinkType_1 = {
      symlinkType,
      symlinkTypeSync
    };
    const u$8 = universalify.fromCallback;
    const {
      fs: fs$8,
      path: path$9
    } = external;
    const mkdirs$2 = mkdirs.mkdirs;
    const mkdirsSync$1 = mkdirs.mkdirsSync;
    const symlinkPaths$1 = symlinkPaths_1.symlinkPaths;
    const symlinkPathsSync$1 = symlinkPaths_1.symlinkPathsSync;
    const symlinkType$1 = symlinkType_1.symlinkType;
    const symlinkTypeSync$1 = symlinkType_1.symlinkTypeSync;
    const pathExists$4 = pathExists_1.pathExists;

    function createSymlink(srcpath, dstpath, type, callback) {
      callback = typeof type === 'function' ? type : callback;
      type = typeof type === 'function' ? false : type;
      pathExists$4(dstpath, (err, destinationExists) => {
        if (err) return callback(err);
        if (destinationExists) return callback(null);
        symlinkPaths$1(srcpath, dstpath, (err, relative) => {
          if (err) return callback(err);
          srcpath = relative.toDst;
          symlinkType$1(relative.toCwd, type, (err, type) => {
            if (err) return callback(err);
            const dir = path$9.dirname(dstpath);
            pathExists$4(dir, (err, dirExists) => {
              if (err) return callback(err);
              if (dirExists) return fs$8.symlink(srcpath, dstpath, type, callback);
              mkdirs$2(dir, err => {
                if (err) return callback(err);
                fs$8.symlink(srcpath, dstpath, type, callback);
              });
            });
          });
        });
      });
    }

    function createSymlinkSync(srcpath, dstpath, type) {
      const destinationExists = fs$8.existsSync(dstpath);
      if (destinationExists) return undefined;
      const relative = symlinkPathsSync$1(srcpath, dstpath);
      srcpath = relative.toDst;
      type = symlinkTypeSync$1(relative.toCwd, type);
      const dir = path$9.dirname(dstpath);
      const exists = fs$8.existsSync(dir);
      if (exists) return fs$8.symlinkSync(srcpath, dstpath, type);
      mkdirsSync$1(dir);
      return fs$8.symlinkSync(srcpath, dstpath, type);
    }

    var symlink = {
      createSymlink: u$8(createSymlink),
      createSymlinkSync
    };
    var ensure = {
      // file
      createFile: file.createFile,
      createFileSync: file.createFileSync,
      ensureFile: file.createFile,
      ensureFileSync: file.createFileSync // link
      // createLink: link.createLink,
      // createLinkSync: link.createLinkSync,
      // ensureLink: link.createLink,
      // ensureLinkSync: link.createLinkSync,
      // symlink
      // createSymlink: symlink.createSymlink,
      // createSymlinkSync: symlink.createSymlinkSync,
      // ensureSymlink: symlink.createSymlink,
      // ensureSymlinkSync: symlink.createSymlinkSync

    };
    const {
      buffer,
      fs: _fs
    } = external;

    function stringify(obj, {
      EOL = '\n',
      finalEOL = true,
      replacer = null,
      spaces
    } = {}) {
      const EOF = finalEOL ? EOL : '';
      const str = JSON.stringify(obj, replacer, spaces);
      return str.replace(/\n/g, EOL) + EOF;
    }

    function stripBom(content) {
      // we do this because JSON.parse would convert it to a utf8 string if encoding wasn't specified
      if (buffer.Buffer.isBuffer(content)) content = content.toString('utf8');
      return content.replace(/^\uFEFF/, '');
    }

    async function _readFile(file, options = {}) {
      if (typeof options === 'string') {
        options = {
          encoding: options
        };
      }

      const fs = options.fs || _fs;
      const shouldThrow = 'throws' in options ? options.throws : true;
      let data = await universalify.fromCallback(fs.readFile)(file, options);
      data = stripBom(data);
      let obj;

      try {
        obj = JSON.parse(data, options ? options.reviver : null);
      } catch (err) {
        if (shouldThrow) {
          err.message = `${file}: ${err.message}`;
          throw err;
        } else {
          return null;
        }
      }

      return obj;
    }

    const readFile = universalify.fromPromise(_readFile);

    function readFileSync(file, options = {}) {
      if (typeof options === 'string') {
        options = {
          encoding: options
        };
      }

      const fs = options.fs || _fs;
      const shouldThrow = 'throws' in options ? options.throws : true;

      try {
        let content = fs.readFileSync(file, options);
        content = stripBom(content);
        return JSON.parse(content, options.reviver);
      } catch (err) {
        if (shouldThrow) {
          err.message = `${file}: ${err.message}`;
          throw err;
        } else {
          return null;
        }
      }
    }

    async function _writeFile(file, obj, options = {}) {
      const fs = options.fs || _fs;
      const str = stringify(obj, options);
      await universalify.fromCallback(fs.writeFile)(file, str, options);
    }

    const writeFile = universalify.fromPromise(_writeFile);

    function writeFileSync(file, obj, options = {}) {
      const fs = options.fs || _fs;
      const str = stringify(obj, options); // not sure if fs.writeFileSync returns anything, but just in case

      return fs.writeFileSync(file, str, options);
    }

    const jsonFile = {
      readFile,
      readFileSync,
      writeFile,
      writeFileSync
    };
    var jsonfile = {
      // jsonfile exports
      readJson: jsonFile.readFile,
      readJsonSync: jsonFile.readFileSync,
      writeJson: jsonFile.writeFile,
      writeJsonSync: jsonFile.writeFileSync,
      stringify,
      stripBom
    };
    const u$9 = universalify.fromCallback;
    const {
      fs: fs$9,
      path: path$a
    } = external;
    const pathExists$5 = pathExists_1.pathExists;

    function outputFile(file, data, encoding, callback) {
      if (typeof encoding === 'function') {
        callback = encoding;
        encoding = 'utf8';
      }

      const dir = path$a.dirname(file);
      pathExists$5(dir, (err, itDoes) => {
        if (err) return callback(err);
        if (itDoes) return fs$9.writeFile(file, data, encoding, callback);
        mkdirs.mkdirs(dir, err => {
          if (err) return callback(err);
          fs$9.writeFile(file, data, encoding, callback);
        });
      });
    }

    function outputFileSync(file, ...args) {
      const dir = path$a.dirname(file);

      if (fs$9.existsSync(dir)) {
        return fs$9.writeFileSync(file, ...args);
      }

      mkdirs.mkdirsSync(dir);
      fs$9.writeFileSync(file, ...args);
    }

    var output = {
      outputFile: u$9(outputFile),
      outputFileSync
    };
    const {
      stringify: stringify$1
    } = jsonfile;
    const {
      outputFile: outputFile$1
    } = output;

    async function outputJson(file, data, options = {}) {
      const str = stringify$1(data, options);
      await outputFile$1(file, str, options);
    }

    var outputJson_1 = outputJson;
    const {
      stringify: stringify$2
    } = jsonfile;
    const {
      outputFileSync: outputFileSync$1
    } = output;

    function outputJsonSync(file, data, options) {
      const str = stringify$2(data, options);
      outputFileSync$1(file, str, options);
    }

    var outputJsonSync_1 = outputJsonSync;
    const u$a = universalify.fromPromise;
    jsonfile.outputJson = u$a(outputJson_1);
    jsonfile.outputJsonSync = outputJsonSync_1; // aliases

    jsonfile.outputJSON = jsonfile.outputJson;
    jsonfile.outputJSONSync = jsonfile.outputJsonSync;
    jsonfile.writeJSON = jsonfile.writeJson;
    jsonfile.writeJSONSync = jsonfile.writeJsonSync;
    jsonfile.readJSON = jsonfile.readJson;
    jsonfile.readJSONSync = jsonfile.readJsonSync;
    var json = jsonfile;
    const {
      fs: fs$a,
      path: path$b
    } = external;
    const copySync$2 = copySync$1.copySync;
    const removeSync = remove.removeSync;
    const mkdirpSync = mkdirs.mkdirpSync;

    function moveSync(src, dest, opts) {
      opts = opts || {};
      const overwrite = opts.overwrite || opts.clobber || false;
      const {
        srcStat
      } = stat_1.checkPathsSync(src, dest, 'move');
      stat_1.checkParentPathsSync(src, srcStat, dest, 'move');
      mkdirpSync(path$b.dirname(dest));
      return doRename(src, dest, overwrite);
    }

    function doRename(src, dest, overwrite) {
      if (overwrite) {
        removeSync(dest);
        return rename(src, dest, overwrite);
      }

      if (fs$a.existsSync(dest)) throw new Error('dest already exists.');
      return rename(src, dest, overwrite);
    }

    function rename(src, dest, overwrite) {
      try {
        fs$a.renameSync(src, dest);
      } catch (err) {
        if (err.code !== 'EXDEV') throw err;
        return moveAcrossDevice(src, dest, overwrite);
      }
    }

    function moveAcrossDevice(src, dest, overwrite) {
      const opts = {
        overwrite,
        errorOnExist: true
      };
      copySync$2(src, dest, opts);
      return removeSync(src);
    }

    var moveSync_1 = moveSync;
    var moveSync$1 = {
      moveSync: moveSync_1
    };
    const {
      fs: fs$b,
      path: path$c
    } = external;
    const copy$2 = copy$1.copy;
    const remove$1 = remove.remove;
    const mkdirp = mkdirs.mkdirp;
    const pathExists$6 = pathExists_1.pathExists;

    function move(src, dest, opts, cb) {
      if (typeof opts === 'function') {
        cb = opts;
        opts = {};
      }

      const overwrite = opts.overwrite || opts.clobber || false;
      stat_1.checkPaths(src, dest, 'move', (err, stats) => {
        if (err) return cb(err);
        const {
          srcStat
        } = stats;
        stat_1.checkParentPaths(src, srcStat, dest, 'move', err => {
          if (err) return cb(err);
          mkdirp(path$c.dirname(dest), err => {
            if (err) return cb(err);
            return doRename$1(src, dest, overwrite, cb);
          });
        });
      });
    }

    function doRename$1(src, dest, overwrite, cb) {
      if (overwrite) {
        return remove$1(dest, err => {
          if (err) return cb(err);
          return rename$1(src, dest, overwrite, cb);
        });
      }

      pathExists$6(dest, (err, destExists) => {
        if (err) return cb(err);
        if (destExists) return cb(new Error('dest already exists.'));
        return rename$1(src, dest, overwrite, cb);
      });
    }

    function rename$1(src, dest, overwrite, cb) {
      fs$b.rename(src, dest, err => {
        if (!err) return cb();
        if (err.code !== 'EXDEV') return cb(err);
        return moveAcrossDevice$1(src, dest, overwrite, cb);
      });
    }

    function moveAcrossDevice$1(src, dest, overwrite, cb) {
      const opts = {
        overwrite,
        errorOnExist: true
      };
      copy$2(src, dest, opts, err => {
        if (err) return cb(err);
        return remove$1(src, cb);
      });
    }

    var move_1 = move;
    const u$b = universalify.fromCallback;
    var move$1 = {
      move: u$b(move_1)
    };
    var lib = Object.assign({}, fs_1, copySync$1, copy$1, empty, ensure, json, mkdirs, moveSync$1, move$1, output, pathExists_1, remove);
    return lib;
  }();

  return fsExtra;
};
