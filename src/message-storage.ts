import Debug from 'debug'

import type * as chat1 from 'keybase-bot/lib/types/chat1'
import type { CleanedMessage } from './types'

const debug = Debug('keybase-export:message-storage')

type MsgMap = Map<number /* id */, {
  msg: CleanedMessage,
  timer: NodeJS.Timeout,
  timerFn: (() => void)
}>

// TODO: Perhaps 'MessageStorage' is not a good name.

/** Used in watcher for saving future editions & deletions */
export class MessageStorage {
  private readonly map: MsgMap = new Map()
  private readonly timeout: number // ms

  constructor (timeout: number /* s */) {
    this.timeout = timeout * 1000
  }

  /** NOTE: Instance can mutate `msg` */
  add (msg: CleanedMessage, timerExpired: (m: CleanedMessage) => void): void {
    const timerFn = () => {
      this.map.delete(msg.id)
      timerExpired(msg)
    }
    const timer = setTimeout(timerFn, this.timeout)
    this.map.set(msg.id, { msg, timer, timerFn })
  }

  edit (content: chat1.MessageEdit): void {
    const id = content.messageId
    const value = this.map.get(id)
    if (!value)
      return debug(`edit: No msg with id ${id}`)
    const { msg, timerFn } = value
    msg.text = content.body
    clearTimeout(value.timer)
    const timer = setTimeout(timerFn, this.timeout)
    value.timer = timer
  }

  delete (content: chat1.MessageDelete): void {
    if (!content.messageIDs) return
    for (const id of content.messageIDs) {
      const value = this.map.get(id)
      if (!value) {
        debug(`delete: No msg with id ${id}`)
        continue
      }
      clearTimeout(value.timer)
      this.map.delete(id)
    }
  }
}
