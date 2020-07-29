## keybase-export

[![npm](https://img.shields.io/npm/v/keybase-export.svg)](https://www.npmjs.com/package/keybase-export)

A tool to export keybase chats.

### Features

- [x] Configuration file
- [x] Watcher
- [ ] Incremental export
- [x] Export to ElasticSearch
- [x] Export to [jsonl][] (json lines)
- [ ] Export to SQLite
- [ ] Attachment downloading

[jsonl]: http://jsonlines.org/

### Config

See [config.example.json][] for example and [config.ts][] for config schema.

[config.example.json]: config.example.json
[config.ts]: src/config.ts

### Installation

Via npm:

```sh
npm install keybase-export
# global installation: $ npm install -g keybase-export
```

Or clone from GitHub:

```sh
git clone https://github.com/Bannerets/keybase-export.git
cd keybase-export
npm install
npm run build
```

#### Requirements

- Node.js v6.0.0+

### Run

1. Copy `config.example.json` to `config.json` and edit it.
2. `$ ./bin/keybase-export` or `$ node dist`

```console
$ keybase-export [path/to/config]
```

Debug mode: `DEBUG=keybase-export* ./bin/keybase-export`
