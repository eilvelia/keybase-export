import fs from 'fs'
import { Client as EsClient } from 'elasticsearch'
import { config } from './config'
import type { CleanedMessage } from './types'

import type * as chat1 from 'keybase-bot/lib/types/chat1'

export interface IDumper {
  init(): Promise<void>;
  saveMessage(chat: chat1.ConvSummary, msg: CleanedMessage): Promise<void>;
  saveChunk(chat: chat1.ConvSummary, msgs: CleanedMessage[]): Promise<void>;
}

function genEsIndexName (chat: chat1.ConvSummary) {
  return config.elasticsearch.indexPattern
    .replace('$channelname$', chat.channel.name)
}

class ElasticDumper implements IDumper {
  private readonly client = new EsClient(config.elasticsearch.config)

  async init () {
    await this.client.ping({})
      .catch((e: any) => { throw new Error(`Elasticsearch is down: ${e}`) })
  }

  async saveMessage (chat: chat1.ConvSummary, msg: CleanedMessage) {
    const indexName = genEsIndexName(chat)
    await this.client.index({
      index: indexName,
      type: '_doc',
      id: msg.id.toString(),
      body: msg
    })
  }

  async saveChunk (chat: chat1.ConvSummary, msgs: CleanedMessage[]) {
    const indexName = genEsIndexName(chat)
    const preparedChunk = msgs.reduce((acc, msg) => {
      acc.push({ index: { _id: msg.id.toString() } })
      acc.push(msg)
      return acc
    }, [] as any[])
    await this.client.bulk({
      index: indexName,
      type: '_doc',
      body: preparedChunk
    })
  }
}

class JsonlDumper implements IDumper {
  private readonly stream = fs.createWriteStream(config.jsonl.file)

  private asyncWrite (str: string): Promise<void> {
    return new Promise(resolve => {
      this.stream.write(str, () => {
        resolve()
      })
    })
  }

  private stringify (chat: chat1.ConvSummary, msg: CleanedMessage): string {
    return JSON.stringify({ ...msg, channel_name: chat.channel.name })
  }

  async init () {}

  saveMessage (chat: chat1.ConvSummary, msg: CleanedMessage) {
    const str = this.stringify(chat, msg) + config.eol
    return this.asyncWrite(str)
  }

  saveChunk (chat: chat1.ConvSummary, msgs: CleanedMessage[]) {
    const str = msgs.map(m => this.stringify(chat, m)).join(config.eol) + config.eol
    return this.asyncWrite(str)
  }
}

export class Dumper implements IDumper {
  private readonly clients: IDumper[] = []

  constructor () {
    if (config.elasticsearch.enabled)
      this.clients.push(new ElasticDumper())

    if (config.jsonl.enabled)
      this.clients.push(new JsonlDumper())
  }

  async init () {
    await Promise.all(
      this.clients.map(cl => cl.init()))
  }

  async saveMessage (chat: chat1.ConvSummary, msg: CleanedMessage) {
    await Promise.all(
      this.clients.map(cl => cl.saveMessage(chat, msg)))
  }

  async saveChunk (chat: chat1.ConvSummary, msgs: CleanedMessage[]) {
    await Promise.all(
      this.clients.map(cl => cl.saveChunk(chat, msgs)))
  }
}
