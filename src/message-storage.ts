import Debug from 'debug'

import type * as chat1 from 'keybase-bot/lib/types/chat1'
import type { CleanedMessage } from './types'

const debugWatcher = Debug('keybase-export:message-storage:watcher')
const debugAlter = Debug('keybase-export:message-storage:alteration')

// TODO: Refactor it in a more generic fashion?

type MsgId = number

type WatcherMsgObject = {
  msg: CleanedMessage,
  timer: NodeJS.Timeout,
  timerFn: () => void
}
type WatcherMap = Map<MsgId, WatcherMsgObject>

/** A temporary message storage for a channel.
  * Past messages go first.
  * Used in the watcher to save future editions & deletions */
export class WatcherStorage {
  private readonly map: WatcherMap = new Map()
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

  edit (content: chat1.MessageEdit, sender: chat1.MsgSender): void {
    const id = content.messageId
    const value = this.map.get(id)
    if (!value)
      return debugWatcher(`edit: No msg with id ${id}`)
    const { msg, timerFn } = value
    msg.text = content.body
    msg.device_id = sender.deviceId
    msg.device_name = sender.deviceName
    clearTimeout(value.timer)
    const timer = setTimeout(timerFn, this.timeout)
    value.timer = timer
  }

  delete (content: chat1.MessageDelete): void {
    if (!content.messageIDs) return
    for (const id of content.messageIDs) {
      const value = this.map.get(id)
      if (!value) {
        debugWatcher(`delete: No msg with id ${id}`)
        continue
      }
      clearTimeout(value.timer)
      this.map.delete(id)
    }
  }
}

export type AlterObj = {
  type: 'edited' | 'deleted',
  text?: string,
  device_id: string,
  device_name?: string
}
type AlterationMap = Map<MsgId, AlterObj>

/** A storage for all edits & deletions in a channel.
  * Future edits / deletions go first.
  * Used in the exporter to mark past messages as "edited" and save correct device ids.
  */
export class AlterationStorage {
  private readonly map: AlterationMap = new Map()

  private skipPastAlteration (action: string, id: number): boolean {
    const oldAlterObj = this.map.get(id)
    if (oldAlterObj) {
      debugAlter(`${action}: message with id ${id} has been already edited or deleted`)
      return true
    }
    return false
  }

  edit (msg: chat1.MsgSummary): void {
    if (msg.content.edit == null)
      throw new Error(`Message ${msg.id} doesn't contain the 'edit' field`)
    const id = msg.content.edit.messageId
    // Skip if a newer edit is already inside the map
    if (this.skipPastAlteration('edit', id)) return
    // TODO: Add edit time (msg.sent_at_ms) as a field?
    const alterObj = {
      type: 'edited' as const,
      text: msg.content.edit.body,
      device_id: msg.sender.deviceId,
      device_name: msg.sender.deviceName // TODO: device name doesn't seem to update here
    }
    this.map.set(id, alterObj)
  }

  delete (msg: chat1.MsgSummary): void {
    if (msg.content.delete == null)
      throw new Error(`Message ${msg.id} doesn't contain the 'delete' field`)
    if (msg.content.delete.messageIDs == null) {
      debugAlter(`delete: messageIDs is empty (Message ${msg.id})`)
      return
    }
    for (const id of msg.content.delete.messageIDs) {
      if (this.skipPastAlteration('delete', id)) continue
      const alterObj = {
        type: 'deleted' as const,
        device_id: msg.sender.deviceId,
        device_name: msg.sender.deviceName
      }
      this.map.set(id, alterObj)
    }
  }

  get (id: number): AlterObj | undefined {
    return this.map.get(id)
  }
}
