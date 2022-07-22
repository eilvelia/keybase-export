import fs from 'fs'
import Joi from '@hapi/joi'
// import { fatal } from './log'

export type Config = {
  // To see the list of all your chats, run $ keybase chat api -p -m '{"method": "list"}'
  // Or, more conveniently, with jq:
  // $ keybase chat api -p -m '{"method": "list"}' | jq '.result.conversations'
  // This accepts strings of the following forms:
  //   - you,them
  //   - family#general
  //   - $id$0000f0b5c2c2211c8d67ed15e75e656c7862d086e9245420892a7de62cd9ec58
  chats: string[],
  init: {
    type: 'init',
    username: string,
    paperkey: string
  } | {
    // NOTE: The watcher doesn't seem to collect user's own messages with this option
    // NOTE: It seems like some messages may be outdated with this option
    type: 'initFromRunningService'
  },
  watcher: {
    enabled: boolean,
    timeout: number // seconds
  },
  attachments: {
    addStub: boolean // Adds '[Attachment <filename>]' to the caption
  },
  // // (Incremental export is not implemented)
  // incremental: {
  //   enabled: boolean,
  //   sessionFile: string // like "keybase-export.session"
  // },
  messageTypes: {
    reactions: boolean,
    reactionMessages: boolean,
    systemMessages: boolean,
    headline: boolean
  },
  jsonl: {
    enabled: boolean,
    file: string
  },
  elasticsearch: {
    enabled: boolean,
    indexPattern: string,
    config: Record<string, any> // ElasticSearch config
  },
  eol: string
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
  // incremental: Joi.object({
  //   enabled: Joi.boolean(),
  //   sessionFile: Joi.string()
  // }),
  messageTypes: Joi.object({
    reactions: Joi.boolean().default(true),
    reactionMessages: Joi.boolean().default(true),
    systemMessages: Joi.boolean().default(true),
    headline: Joi.boolean().default(true)
  }).default(),
  attachments: Joi.object({
    addStub: Joi.boolean().default(true)
  }).default(),
  jsonl: Joi.object({
    enabled: Joi.boolean().default(false),
    file: Joi.string().default('export.jsonl')
  }).default(),
  elasticsearch: Joi.object({
    enabled: Joi.boolean().default(false),
    indexPattern: Joi.string().default('keybase_$channelname$'),
    config: Joi.object().default({ host: 'localhost:9200', log: 'info' })
  }).default(),
  eol: Joi.string().default('\n')
}).unknown(true)

const configPath = process.argv[2] || 'config.json'

const untrustedConfig = JSON.parse(fs.readFileSync(configPath).toString())

const result = schema.validate(untrustedConfig)

if (result.error) throw result.error

export const config: Config = result.value
