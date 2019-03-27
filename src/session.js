// @flow

import Debug from 'debug'
import { warn } from './log'
import { fsReadAsync, fsWriteAsync } from './util'
import { config } from './config'

const debug = Debug('keybase-export:session')

// Session file format (EBNF):
// chat-session ::= <chat-id> ">>" <pagination-next>
// session-file ::= <chat-session> { "\n" <chat-session> }

export type ChatId = string
export type PaginationNext = string
export type SessionData = Map<ChatId, PaginationNext>

async function readSession (file: string): Promise<SessionData> {
  const map: SessionData = new Map()
  const filebuf = await fsReadAsync(file)
  const filestr = filebuf.toString()
  for (const str of filestr.split('\n')) {
    if (str.trim() === '')
      continue
    const [chatId, pagNext] = str.split('>>').map(s => s.trim())
    if (!chatId || !pagNext) {
      warn(`Invalid chat-session string: ${str}`)
      continue
    }
    map.set(chatId, pagNext)
  }
  return map
}

function writeSession (file: string, map: SessionData): Promise<void> {
  const strs = []
  for (const [chatId, pagNext] of map.entries()) {
    const str = `${chatId}>>${pagNext}`
    strs.push(str)
  }
  return fsWriteAsync(file, strs.join('\n'))
}

const TIMEOUT = 1000

export interface ISession {
  init(): Promise<void>;
  forceSave(): Promise<void>;
  get(chatId: ChatId): PaginationNext | void;
  update(chatId: ChatId, pagNext: PaginationNext): void;
}

class Session implements ISession {
  +_file: string;
  _map: SessionData = new Map();
  _timer: TimeoutID;
  _changed = false
  _error: ?Error = null

  constructor (sessionFile: string) {
    this._file = sessionFile
  }

  async _save (): Promise<void> {
    if (!this._changed) return
    debug('writeSession')
    await writeSession(this._file, this._map)
    this._changed = false
  }

  _loop = (): void => {
    this._save()
      .then(() => this._timer = setTimeout(this._loop, TIMEOUT))
      .catch(e => this._error = new Error(e))
  }

  async init (): Promise<void> {
    await readSession(this._file)
      .then(map => { this._map = map }, debug)
    this._loop()
  }

  forceSave (): Promise<void> {
    clearTimeout(this._timer)
    return this._save()
  }

  get (chatId: ChatId): PaginationNext | void {
    return this._map.get(chatId)
  }

  update (chatId: ChatId, pagNext: PaginationNext): void {
    if (this._error) throw this._error
    this._map.set(chatId, pagNext)
    this._changed = true
  }
}

class SessionStub implements ISession {
  async init () {}
  async forceSave () {}
  get () {}
  update () {}
}

export function createSession (): ISession {
  if (config.incremental.enabled)
    return new Session(config.incremental.sessionFile)

  return new SessionStub()
}
