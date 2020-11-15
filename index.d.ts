interface ExternalModules {
  assert: any
  path: any
  process: any
  buffer: any
  fs: any
}

declare function fsExtraFactory(external: ExternalModules): typeof import('fs-extra')

export = fsExtraFactory
