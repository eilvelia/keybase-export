// @flow

import Debug from 'debug'

import type {
  EditContent,
  DeleteContent
} from 'keybase-bot/lib/chat-client/types'

import type { CleanedMessage } from './types'

const debug = Debug('keybase-export:message-storage')

/** Used in watcher for saving future editions & deletions */
export class MessageStorage {
  +_map
    : Map<number /* id */, {
        msg: CleanedMessage,
        timer: TimeoutID,
        timerFn: (void => void)
      }>
    = new Map();
  +_timeout: number // ms

  constructor (timeout: number /* s */) {
    this._timeout = timeout * 1000
  }

  /** NOTE: Instance can mutate `msg` */
  add (msg: CleanedMessage, timerExpired: CleanedMessage => void) {
    const timerFn = () => {
      this._map.delete(msg.id)
      timerExpired(msg)
    }
    const timer = setTimeout(timerFn, this._timeout)
    this._map.set(msg.id, { msg, timer, timerFn })
  }

  edit (content: EditContent) {
    const id = content.edit.messageId
    const value = this._map.get(id)
    if (!value)
      return debug(`edit: No msg with id ${id}`)
    const { msg, timerFn } = value
    msg.text = content.edit.body
    clearTimeout(value.timer)
    const timer = setTimeout(timerFn, this._timeout)
    value.timer = timer
  }

  delete (content: DeleteContent) {
    for (const id of content.delete.messageIDs) {
      const value = this._map.get(id)
      if (!value) {
        debug(`delete: No msg with id ${id}`)
        continue
      }
      clearTimeout(value.timer)
      this._map.delete(id)
    }
  }
}
