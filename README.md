# keybase-export &nbsp; [![npm](https://img.shields.io/npm/v/keybase-export.svg)](https://www.npmjs.com/package/keybase-export)

A tool to export [Keybase][] chats.

[Keybase]: https://keybase.io/

## Features

- [x] Configuration file
- [x] Export to [jsonl][] (json lines)
- [ ] Export to SQLite
- [x] Watcher for new messages
- [x] Attachment downloading
- [x] Incremental export

[jsonl]: http://jsonlines.org/

## Requirements

- Node.js (around version 18 or newer)

## Installation

`keybase-export` can be installed via npm:

```console
$ npm install --global keybase-export
```

It is also possible to launch it as `npx keybase-export` without installation.

Alternatively, the latest possible version can be obtained by
cloning the repository and running `npm install`.

## Usage

```console
$ keybase-export [<options>] [<config>]
```

The configuration of `keybase-export` is pretty barebones: it reads everything
it needs from a json file, that can be specified as a command line argument, or
defaults to the `config.json` file in the current working directory. See the
[config.example.json][] file for a config example and [config.ts][] for the
config schema.

`keybase-export --init <filename>` copies the config example to `<filename>`.
Afterwards, you should edit it. At the very least, the `chats`, `username`,
and `paperkey` fields should be replaced. That is, for this to work, you
should generate a paper key and paste it into the config. (There is an
alternative `initFromRunningService` method that uses the running
instance of keybase, but it is not as stable.)

To enable debug logs, set the `DEBUG` env variable to `keybase-export*`.

The incremental mode feature is a bit experimental.

[config.example.json]: config.example.json
[config.ts]: src/config.ts

## Troubleshooting

- `Path can't be longer than 108 characters (failed to chdir)`

On macOS, this error can occur during attachment downloading due to way too long
`$TMPDIR`. As a workaround, just set the `TMPDIR` env variable to something
shorter.
