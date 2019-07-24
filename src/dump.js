// @flow

import fs from 'fs'
import { Client as EsClient } from 'elasticsearch'
import { config } from './config'
import type { ChatConversation } from 'keybase-bot/lib/chat-client/types'
import type { CleanedMessage } from './types'

export interface IDumper {
  init(): Promise<void>;
  saveMessage(chat: ChatConversation, msg: CleanedMessage): Promise<void>;
  saveChunk(chat: ChatConversation, msgs: CleanedMessage[]): Promise<void>;
}

function genEsIndexName (chat: ChatConversation) {
  return config.elasticsearch.indexPattern
    .replace('$channelname$', chat.channel.name)
}

class ElasticDumper implements IDumper {
  +_client = new EsClient(config.elasticsearch.config)

  async init () {
    await this._client.ping({})
      .catch(e => { throw new Error(`Elasticsearch is down: ${e}`) })
  }

  async saveMessage (chat: ChatConversation, msg: CleanedMessage) {
    const indexName = genEsIndexName(chat)
    await this._client.index({
      index: indexName,
      type: '_doc',
      id: msg.id.toString(),
      body: msg
    })
  }

  async saveChunk (chat: ChatConversation, msgs: CleanedMessage[]) {
    const indexName = genEsIndexName(chat)
    const preparedChunk: Object[] = msgs.reduce((acc, msg) => {
      acc.push({ index: { _id: msg.id.toString() } })
      acc.push(msg)
      return acc
    }, [])
    await this._client.bulk({
      index: indexName,
      type: '_doc',
      body: preparedChunk
    })
  }
}

class JsonlDumper implements IDumper {
  +_stream = fs.createWriteStream(config.jsonl.file)

  _asyncWrite (str: string): Promise<void> {
    return new Promise(resolve => {
      this._stream.write(str, () => {
        resolve()
      })
    })
  }

  async init () {}

  saveMessage (chat: ChatConversation, msg: CleanedMessage) {
    const str = JSON.stringify(msg) + config.eol
    return this._asyncWrite(str)
  }

  saveChunk (chat: ChatConversation, msgs: CleanedMessage[]) {
    const str = msgs.map(m => JSON.stringify(m)).join(config.eol) + config.eol
    return this._asyncWrite(str)
  }
}

export class Dumper implements IDumper {
  +_clients: IDumper[] = []

  constructor () {
    if (config.elasticsearch.enabled)
      this._clients.push(new ElasticDumper())

    if (config.jsonl.enabled)
      this._clients.push(new JsonlDumper())
  }

  async init () {
    await Promise.all(
      this._clients.map(cl => cl.init()))
  }

  async saveMessage (chat: ChatConversation, msg: CleanedMessage) {
    await Promise.all(
      this._clients.map(cl => cl.saveMessage(chat, msg)))
  }

  async saveChunk (chat: ChatConversation, msgs: CleanedMessage[]) {
    await Promise.all(
      this._clients.map(cl => cl.saveChunk(chat, msgs)))
  }
}
