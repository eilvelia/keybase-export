// @flow

import fs from 'fs'

export const fsReadAsync = (path: string): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    fs.readFile(path, (err, data) => {
      if (err) return reject(err)
      resolve(data)
    })
  })

export const fsWriteAsync = (
  path: string,
  data: Buffer | string
): Promise<void> =>
  new Promise((resolve, reject) => {
    fs.writeFile(path, data, err => {
      if (err) return reject(err)
      resolve()
    })
  })
