import path from 'path'
import fsp from 'fs/promises'
import Debug from 'debug'
import Bot from 'keybase-bot'
import { warn, err, fatal } from './log'
import { config } from './config'
import { Dumper } from './dump'
import { WatcherStorage, AlterationStorage } from './message-storage'
import { convertSystemMessage } from './system-message'

import type * as chat1 from 'keybase-bot/lib/types/chat1'
import type { ReadResult, OnMessage, OnError } from 'keybase-bot/lib/chat-client'
import type { CleanedMessage } from './types'

const debug = Debug('keybase-export')

const bot = new Bot()
const dumper = new Dumper()

const INIT_OPTIONS = {
  disableTyping: true
}

async function init () {
  const initConfig = config.init
  if (initConfig.type === 'initFromRunningService') {
    debug('init: initFromRunningService start')
    await bot.initFromRunningService()
  } else {
    debug('init: init start')
    await bot.init(initConfig.username, initConfig.paperkey, INIT_OPTIONS)
  }
  debug('init: end')
}

function getChannelName (channel: chat1.ChatChannel) {
  return channel.topicName
    ? channel.name + '#' + channel.topicName
    : channel.name
}

function findChat (chats: chat1.ConvSummary[], query: string): chat1.ConvSummary | undefined {
  // Query string examples:
  //   - you,them
  //   - family#general
  //   - $id$0000f0b5c2c2211c8d67ed15e75e656c7862d086e9245420892a7de62cd9ec58

  const specialMode = query.match(/^\$(.+?)\$(.+)/)

  if (!specialMode) {
    const [teamName, channelName] = query.split('#')
    if (channelName) {
      // Search by channel/topic of a big team
      return chats.find(({ channel }) =>
        channel.name === teamName && channel.topicName === channelName)
    }

    // Search by channel name (like `you,them`)
    return chats.find(chat => chat.channel.name === query)
  }

  const [, mode, value] = specialMode

  switch (mode) {
    case 'id':
      // Search by chat id
      return chats.find(chat => chat.id === value)
    default:
      warn(`Unknown mode '${mode}'`)
  }
}

async function fileExists (filename: string) {
  try {
    await fsp.stat(filename)
    return true
  } catch (e) {
    // Currently we don't check for other possible errors
    return false
  }
}

class Attachments {
  private queue: chat1.MsgSummary[] = []
  private downloading = false
  private callbacks: (() => void)[] = []

  queueDownload (msg: chat1.MsgSummary) {
    if (!config.attachments.download) return
    this.queue.push(msg)
    if (!this.downloading)
      this.loop().catch(console.error)
  }

  waitUntilFinished (): Promise<void> {
    if (!this.downloading) return Promise.resolve()
    return new Promise(resolve => this.callbacks.push(resolve))
  }

  private async loop () {
    this.downloading = true
    while (this.queue.length > 0) {
      let target: string | null = null
      try {
        const msg = this.queue.shift() as chat1.MsgSummary
        if (!msg.content.attachment) throw Error('No content.attachment')
        const objectFilename = msg.content.attachment.object.filename || ''
        const subdir = getChannelName(msg.channel)
        const filename = `${msg.id}-${objectFilename}`
        target = `${subdir}/${filename}`
        const downloadDir = path.join(config.attachments.directory, subdir)
        await fsp.mkdir(downloadDir, { recursive: true })
        const downloadPath = path.resolve(downloadDir, filename)
        if (await fileExists(downloadPath)) {
          this.log(`File ${target} already exists: skipping`)
          continue
        }
        await bot.chat.download(msg.channel, msg.id, downloadPath)
        this.log(`Downloaded ${target}`)
      } catch (e) {
        if (target)
          this.log(`Failed to download ${target}: "${String(e)}"`, true)
        else
          this.log(`Failed to download: "${String(e)}"`, true)
      }
    }
    this.downloading = false
    if (this.callbacks.length > 0) {
      for (const callback of this.callbacks) callback()
      this.callbacks = []
    }
  }

  private log (message: string, stderr = false) {
    const output = `${message} (${this.queue.length} more in the queue).`
    if (stderr) console.error(output); else console.log(output)
  }
}

const attachments = new Attachments()

function convertMessage (msg: chat1.MsgSummary, storage?: AlterationStorage): CleanedMessage | null {
  const alter = storage?.get(msg.id)

  if (alter?.type === 'deleted') {
    warn(`Message ${msg.id} is deleted`)
    return null
  }

  let text
  let edited
  let device_id
  let device_name

  if (alter?.type === 'edited') {
    edited = true as const
    text = alter.text
    device_id = alter.device_id
    device_name = alter.device_name
  } else {
    device_id = msg.sender.deviceId
    device_name = msg.sender.deviceName
  }

  // The undefined fields are defined here to somewhat preserve the order
  const output: CleanedMessage = {
    text,
    id: msg.id,
    reactions: undefined,
    reply_to: undefined,
    attachment: undefined,
    sent_at: msg.sentAt,
    sent_at_ms: msg.sentAtMs,
    edited,
    sender_username: msg.sender.username,
    sender_uid: msg.sender.uid,
    device_id,
    device_name,
    system: undefined,
    special: undefined,
  }

  if (config.messageTypes.reactions && msg.reactions)
    output.reactions = msg.reactions.reactions

  // Note: The jsonl dumper also adds a 'channel_name' field

  const { content } = msg

  switch (content.type) {
    case 'text':
      if (!content.text) break
      const { text } = content
      if (output.text == null) output.text = text.body
      output.reply_to = text.replyTo
      break

    case 'attachment':
      if (!content.attachment) break
      const { attachment } = content
      const { object } = attachment
      // path to attachment = <config.attachments.directory> "/" <msg.channel_name>
      //                      "/" <msg.id> "-" <msg.attachment.filename>
      // not included in the attachment object explicitly for now
      output.attachment = {
        filename: object.filename,
        asset_type: object.metadata.assetType
      }
      output.text = object.title || ''
      break

    case 'reaction':
      if (!config.messageTypes.reactionMessages) return null
      const { reaction } = content
      if (!reaction) break
      output.text = `[Reaction '${reaction.b}' to msg id ${reaction.m}]`
      output.special = true
      break

    case 'system':
      if (!config.messageTypes.systemMessages) return null
      const { system } = content
      if (!system) break
      output.text = `[${convertSystemMessage(system)}]`
      output.system = true
      output.special = true
      break

    case 'headline':
      if (!config.messageTypes.headline) return null
      const { headline } = content
      if (!headline) break
      output.text = `[New headline: "${headline.headline}"]`
      output.special = true
      break

    case 'edit':
      storage?.edit(msg)
      return null

    case 'delete':
      storage?.delete(msg)
      return null
  }

  return output
}

function formatTime (ms: number) {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`
}

// Shouldn't be more than ~950
// UPD: Changed from 900 to 300, 900 stopped working correctly
const CHUNK_SIZE = 300

async function* loadHistory (channel: chat1.ChatChannel) {
  const channelName = getChannelName(channel)
  const startTime = Date.now()
  console.log(`Started loading messages: ${channelName}`)
  let totalMessages = 0
  let next = undefined
  while (true) {
    const { messages, pagination }: ReadResult = await bot.chat.read(channel, {
      peek: true,
      pagination: {
        num: CHUNK_SIZE,
        next
      }
    })
    totalMessages += messages.length
    next = pagination.next
    const validMessages = messages.filter(Boolean)
    if (validMessages.length > 0)
      yield validMessages
    if (pagination.last)
      break
  }
  const elapsed = Date.now() - startTime
  console.log(`Finished loading messages: ${channelName} (total of ${totalMessages} messages/events), took ${formatTime(elapsed)}.`)
}

function watchChat (chat: chat1.ConvSummary): Promise<void> {
  const channelName = getChannelName(chat.channel)
  console.log(`Watching for new messages: ${channelName}`)
  const storage = new WatcherStorage(config.watcher.timeout)
  const onMessage: OnMessage = message => {
    console.log(`Watcher: new message (${message.id}): ${channelName}`)
    const { content } = message
    switch (content.type) {
      case 'edit':
        if (content.edit) storage.edit(content.edit, message.sender)
        return
      case 'delete':
        if (content.delete) storage.delete(content.delete)
        return
      default:
        // Since we enumerate messages from oldest to newest,
        // the alter storage should always be empty.
        const cleanedMessage = convertMessage(message)
        if (!cleanedMessage) return
        if (cleanedMessage.attachment) attachments.queueDownload(message)
        storage.add(cleanedMessage, msg => {
          debug('watchChat save', msg)
          dumper.saveMessage(channelName, msg)
            .catch(err)
        })
    }
  }
  const onError: OnError = error => {
    err(error)
  }
  return bot.chat.watchChannelForNewMessages(chat.channel, onMessage, onError)
}

async function processChat (chat: chat1.ConvSummary) {
  if (config.watcher.enabled)
    await watchChat(chat)

  const alterStorage = new AlterationStorage()

  const channelName = getChannelName(chat.channel)

  for await (const chunk of loadHistory(chat.channel)) {
    console.log(`Received new chunk (${chunk.length} msgs): ${channelName}`)
    const cleanedMessages = chunk
      .map(msg => {
        const newmsg = convertMessage(msg, alterStorage)
        if (newmsg && newmsg.attachment) attachments.queueDownload(msg)
        return newmsg
      })
      .filter((x): x is CleanedMessage => x != null)
    await dumper.saveChunk(channelName, cleanedMessages)
    // console.dir(chunk.slice(-3), { depth: null })
  }
}

// TODO: Incremental mode.

async function main () {
  console.log('Initializing...')

  await init()

  process.on('SIGINT', deinit)
  process.on('SIGTERM', deinit)

  const { watcher } = config

  debug('watcher.enabled', watcher.enabled)
  debug('watcher.timeout', watcher.timeout)

  console.log('Getting chat list...')
  const chats = await bot.chat.list()
  console.log(`Total chats: ${chats.length}`)
  // debug('Chat list', chats); return deinit()

  for (const query of config.chats) {
    const chat = findChat(chats, query)
    if (chat)
      await processChat(chat)
    else
      warn(`Chat '${query}' has not been found`)
  }

  if (watcher.enabled) return

  await attachments.waitUntilFinished()
  await deinit()
}

function deinit (): Promise<void> {
  console.log('Deinitializing')
  return bot.deinit()
    .catch(fatal)
}

dumper.init()
  .then(main)
  .catch(fatal)
