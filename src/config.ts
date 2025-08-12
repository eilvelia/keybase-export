import fs from 'node:fs'
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
    // Download attachments
    download: boolean,
    directory: string
  },
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
  incremental: {
    enabled: boolean,
    previousExportFile: string
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
    download: Joi.boolean().default(false),
    directory: Joi.string().default('attachments')
  }).default().unknown(true),
  jsonl: Joi.object({
    enabled: Joi.boolean().default(false),
    file: Joi.string().default('export.jsonl')
  }).default(),
  incremental: Joi.object({
    enabled: Joi.boolean().default(false),
    previousExportFile: Joi.string().default('old-export.jsonl')
  }).default(),
  eol: Joi.string().default('\n')
}).unknown(true)

let config: Config | null = null

export function initConfig (filename: string): void {
  if (config != null) throw new Error('Config is already initialized')
  const untrustedConfig = JSON.parse(fs.readFileSync(filename).toString())
  const result = schema.validate(untrustedConfig)
  if (result.error) throw result.error
  config = result.value
}

export function getConfig (): Config {
  if (config == null) throw new Error('Config is not initialized')
  return config
}
