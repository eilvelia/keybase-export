import Debug from 'debug'
import Bot from 'keybase-bot'
import { warn, err, fatal } from './log'
import { config } from './config'
import { Dumper } from './dump'
import { MessageStorage } from './message-storage'

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
      return undefined
  }
}

function addAttachmentStub (object: chat1.Asset): string {
  if (!config.attachments.addStub) return object.title
  const space = object.title === '' ? '' : ' '
  return `[Attachment ${object.filename}]${space}${object.title}`
}

function convertMessage (msg: chat1.MsgSummary): CleanedMessage | null {
  const output: CleanedMessage = {
    text: undefined,
    id: msg.id,
    reply_to: undefined,
    attachment: undefined,
    sent_at: msg.sentAt,
    sender_uid: msg.sender.uid,
    sender_username: msg.sender.username,
    device_id: msg.sender.deviceId,
    device_name: msg.sender.deviceName,
    revoked_device: msg.revokedDevice
  }

  const { content } = msg

  switch (content.type) {
    case 'text':
      if (!content.text) break
      const { text } = content
      output.text = text.body
      output.reply_to = text.replyTo
      break

    case 'attachment':
      // TODO: Support attachment downloading
      if (!content.attachment) break
      const { attachment } = content
      const { object } = attachment
      output.attachment = {
        path: object.path,
        asset_type: object.metadata.assetType
      }
      output.text = addAttachmentStub(object)
      break

    // TODO: Support reactions
    case 'reaction': return null

    // Skip 'edit' and 'delete' messages
    case 'edit': return null
    case 'delete': return null
  }

  return output
}

const CHUNK_SIZE = 900 // Shouldn't be more than ~950

async function* loadHistory (channel: chat1.ChatChannel) {
  console.log(`loadHistory start: ${channel.name}`)
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
    if (messages.length > 0)
      yield messages
    if (pagination.last)
      break
  }
  console.log(`loadHistory end: ${channel.name} (${totalMessages} messages)`)
}

function watchChat (chat: chat1.ConvSummary): Promise<void> {
  console.log(`Watching for new messages: ${chat.channel.name}`)
  const storage = new MessageStorage(config.watcher.timeout)
  const onMessage: OnMessage = message => {
    console.log(`Watcher: new message (${message.id}): ${chat.channel.name}`)
    const { content } = message
    switch (content.type) {
      case 'edit':
        if (content.edit) storage.edit(content.edit)
        return
      case 'delete':
        if (content.delete) storage.delete(content.delete)
        return
      default:
        const cleanedMessage = convertMessage(message)
        if (!cleanedMessage) return
        storage.add(cleanedMessage, msg => {
          debug('watchChat save', msg)
          dumper.saveMessage(chat, msg)
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

  for await (const chunk of loadHistory(chat.channel)) {
    debug(`New chunk (${chunk.length}): ${chat.channel.name}`) // for time displaying
    console.log(`New chunk (${chunk.length}): ${chat.channel.name}`)
    const cleanedMessages = chunk
      .map(convertMessage)
      .filter((x): x is CleanedMessage => x != null)
    await dumper.saveChunk(chat, cleanedMessages)
    // console.dir(chunk.slice(-3), { depth: null })
  }
}

// TODO: Incremental mode.

async function main () {
  console.log('Initializing')

  await init()

  process.on('SIGINT', deinit)
  process.on('SIGTERM', deinit)

  const { watcher } = config

  debug('watcher.enabled', watcher.enabled)
  debug('watcher.timeout', watcher.timeout)

  console.log('Getting chat list')
  const chats = await bot.chat.list()
  console.log(`Total chats: ${chats.length}`)
  // debug('Chat list', chats); return deinit()

  for (const query of config.chats) {
    const chat = findChat(chats, query)
    if (chat)
      await processChat(chat)
    else
      warn(`Chat '${query}' not found`)
  }

  if (!watcher.enabled)
    await deinit()
}

function deinit (): Promise<void> {
  console.log('deinit')
  return bot.deinit()
    .catch(fatal)
}

dumper.init()
  .then(main)
  .catch(fatal)
