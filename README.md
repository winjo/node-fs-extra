fs-extra-factory
=================

this is library is mainly built for the browser environment，now `fs-extra-factory` is export a factory, you should pass external module of `fs`, `path`, `process`, `buffer`, `assert`，so we can use [browserfs](https://github.com/jvilk/BrowserFS) with this library


### Usage
```js
import fsExtraFactory from 'fs-extra-factory'
const fs = fsExtraFactory({
  path,
  fs,
  buffer,
  assert,
  process
})
```
the return object fs has same interface with `fs-extra`

### Unit Test
beacuse browserfs does't support some api like `link`, `chmod`, so just skip these cases, now the test result:

156 passing<br/>
578 pending
