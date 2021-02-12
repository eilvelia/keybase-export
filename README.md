## keybase-export

[![npm](https://img.shields.io/npm/v/keybase-export.svg)](https://www.npmjs.com/package/keybase-export)

A tool to export keybase chats.

### Features

- [x] Configuration file
- [x] Export to [jsonl][] (json lines)
- [ ] Export to SQLite
- [x] Export to ElasticSearch
- [x] Watcher for new messages
- [ ] Incremental export
- [ ] Attachment downloading

[jsonl]: http://jsonlines.org/

### Config

See [config.example.json][] for a config example and [config.ts][] for the config schema.

[config.example.json]: config.example.json
[config.ts]: src/config.ts

### Usage

Node.js v6.0.0+ is required.

Install `keybase-export` via npm:

```sh
npm install -g keybase-export
# local installation: $ npm install keybase-export
```

Or clone it from GitHub (recommended):

```sh
git clone https://github.com/Bannerets/keybase-export.git
cd keybase-export
npm install
npm run build
```

Copy `config.example.json` to `config.json` and edit it.

Run:

```console
$ keybase-export [path/to/config]
```

(`$ ./bin/keybase-export` or `$ node dist` if you only cloned the repository)

Debug mode: `DEBUG=keybase-export* keybase-export`
