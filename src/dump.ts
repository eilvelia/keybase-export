import fs from 'node:fs'
import { getConfig } from './config'
import type { CleanedMessage } from './types'

export interface IDumper {
  init(): Promise<void>;
  saveMessage(channelName: string, msg: CleanedMessage): Promise<void>;
  saveChunk(channelName: string, msgs: CleanedMessage[]): Promise<void>;
}

// function genEsIndexName (channelName: string) {
//   return getConfig().elasticsearch.indexPattern
//     .replace('$channelname$', channelName.replace('#', '__'))
// }

// ElasticSearch is no longer supported
// class ElasticDumper implements IDumper {
//   private readonly client = new EsClient(getConfig().elasticsearch.config)

//   async init () {
//     await this.client.ping({})
//       .catch((e: any) => { throw new Error(`Elasticsearch is down: ${e}`) })
//   }

//   async saveMessage (channelName: string, msg: CleanedMessage) {
//     const indexName = genEsIndexName(channelName)
//     await this.client.index({
//       index: indexName,
//       type: '_doc',
//       id: msg.id.toString(),
//       body: msg
//     })
//   }

//   async saveChunk (channelName: string, msgs: CleanedMessage[]) {
//     const indexName = genEsIndexName(channelName)
//     const preparedChunk = msgs.reduce((acc, msg) => {
//       acc.push({ index: { _id: msg.id.toString() } })
//       acc.push(msg)
//       return acc
//     }, [] as any[])
//     await this.client.bulk({
//       index: indexName,
//       type: '_doc',
//       body: preparedChunk
//     })
//   }
// }

class JsonlDumper implements IDumper {
  private readonly stream = fs.createWriteStream(getConfig().jsonl.file)

  private asyncWrite (str: string): Promise<void> {
    return new Promise(resolve => {
      this.stream.write(str, () => {
        resolve()
      })
    })
  }

  private stringify (channelName: string, msg: CleanedMessage): string {
    return JSON.stringify({ ...msg, channel_name: channelName })
  }

  async init () {}

  saveMessage (channelName: string, msg: CleanedMessage) {
    const str = this.stringify(channelName, msg) + getConfig().eol
    return this.asyncWrite(str)
  }

  saveChunk (channelName: string, msgs: CleanedMessage[]) {
    const str = msgs
      .map(m => this.stringify(channelName, m))
      .join(getConfig().eol)
      + getConfig().eol
    return this.asyncWrite(str)
  }
}

export class Dumper implements IDumper {
  private readonly clients: IDumper[] = []

  constructor () {
    // if (getConfig().elasticsearch.enabled)
    //   this.clients.push(new ElasticDumper())

    if (getConfig().jsonl.enabled)
      this.clients.push(new JsonlDumper())
  }

  async init () {
    await Promise.all(
      this.clients.map(cl => cl.init()))
  }

  async saveMessage (channelName: string, msg: CleanedMessage) {
    await Promise.all(
      this.clients.map(cl => cl.saveMessage(channelName, msg)))
  }

  async saveChunk (channelName: string, msgs: CleanedMessage[]) {
    await Promise.all(
      this.clients.map(cl => cl.saveChunk(channelName, msgs)))
  }
}
