import fs from 'fs'
import koaMount from 'koa-mount'
import koaStatic from 'koa-static'
import rimraf from 'rimraf'
import log from '../logging/logger.js'
import path from 'path'
import util from 'util'

// How long browsers can cache resources for (in milliseconds). These resources should all be pretty
// static, so this can be a long time
export const FILE_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000

const accessAsync = util.promisify(fs.access)
const mkdirAsync = util.promisify(fs.mkdir)
const unlinkAsync = util.promisify(fs.unlink)
const rimrafAsync = util.promisify(rimraf)

export default class LocalFsStore {
  constructor({ path }) {
    this.path = path
  }

  _getFullPath(filename) {
    const normalized = path.normalize(filename)
    if (path.isAbsolute(normalized) || normalized[0] === '.') {
      throw new Error('Invalid directory')
    }
    return path.join(this.path, normalized)
  }

  async write(filename, stream) {
    const full = this._getFullPath(filename)
    await mkdirAsync(path.dirname(full), { recursive: true })
    const out = fs.createWriteStream(full)
    stream.pipe(out)
    return new Promise((resolve, reject) => {
      out.on('finish', resolve)
      stream.on('error', reject)
      out.on('error', reject)
    })
  }

  async delete(filename) {
    const full = this._getFullPath(filename)
    try {
      // TODO(2Pac): Delete the directory tree as well, if it's empty
      await unlinkAsync(full)
    } catch (err) {
      // File most likely doesn't exist so there's nothing to delete; just log the error and move on
      log.error({ err }, 'error deleting the file')
    }
  }

  async deleteFiles(prefix) {
    const full = this._getFullPath(prefix)
    try {
      await rimrafAsync(full)
    } catch (err) {
      // File most likely doesn't exist so there's nothing to delete; just log the error and move on
      log.error({ err }, 'error deleting the file')
    }
  }

  async url(filename) {
    const full = this._getFullPath(filename)
    try {
      await accessAsync(full)
      return `${process.env.SB_CANONICAL_HOST}/files/${path.posix.normalize(filename)}`
    } catch (_) {
      return null
    }
  }

  addMiddleware(app) {
    app.use(koaMount('/files', koaStatic(this.path, { maxage: FILE_MAX_AGE_MS })))
  }
}
