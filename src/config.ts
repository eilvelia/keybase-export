import fs from 'fs'
import Joi from '@hapi/joi'
// import { fatal } from './log'

export type Config = {
  chats: string[],
  init: {
    type: 'init',
    username: string,
    paperkey: string
  } | {
    // NOTE: With this setting the watcher doesn't collect user's own messages
    type: 'initFromRunningService'
  },
  watcher: {
    enabled: boolean,
    timeout: number // seconds
  },
  eol: string,
  attachments: {
    addStub: boolean // Adds '[Attachment <filename>]' to the caption
  },
  // incremental: {
  //   enabled: boolean,
  //   sessionFile: string
  // },
    // "incremental": {
    //   "enabled": true,
    //   "sessionFile": "keybase-export.session"
    // },
  elasticsearch: {
    enabled: boolean,
    indexPattern: string,
    config: Record<string, any> // ElasticSearch config
  },
  jsonl: {
    enabled: boolean,
    file: string
  }
}

const schema = Joi.object({
  chats: Joi.array().items(Joi.string()).required(),
  init: Joi.alternatives(
    Joi.object({
      type: Joi.string().valid('init').required(),
      username: Joi.string().required(),
      paperkey: Joi.string().required()
    }),
    Joi.object({
      type: Joi.string().valid('initFromRunningService').required()
    })
  ).required(),
  watcher: Joi.object({
    enabled: Joi.boolean().default(false),
    timeout: Joi.number().default(20)
  }).default(),
  eol: Joi.string().default('\n'),
  // incremental: Joi.object({
  //   enabled: Joi.boolean(),
  //   sessionFile: Joi.string()
  // }),
  attachments: Joi.object({
    addStub: Joi.boolean().default(true)
  }).default(),
  elasticsearch: Joi.object({
    enabled: Joi.boolean().default(false),
    indexPattern: Joi.string().default('keybase_$channelname$'),
    config: Joi.object().default({ host: 'localhost:9200', log: 'info' })
  }).default(),
  jsonl: Joi.object({
    enabled: Joi.boolean().default(false),
    file: Joi.string().default('export.jsonl')
  }).default()
}).unknown(true)

// const configPath = process.argv[2] || 'config.example.json'
const configPath = process.argv[2] || 'config.json'

const untrustedConfig = JSON.parse(fs.readFileSync(configPath).toString())

const result = schema.validate(untrustedConfig)

if (result.error) throw result.error

export const config: Config = result.value
