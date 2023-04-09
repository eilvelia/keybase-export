## keybase-export

[![npm](https://img.shields.io/npm/v/keybase-export.svg)](https://www.npmjs.com/package/keybase-export)

A tool to export keybase chats.

### Features

- [x] Configuration file
- [x] Export to [jsonl][] (json lines)
- [ ] Export to SQLite
- [x] Export to ElasticSearch
- [x] Watcher for new messages
- [x] Attachment downloading
- [ ] Incremental export

[jsonl]: http://jsonlines.org/

### Configuration

See [config.example.json][] for a config example and [config.ts][] for the config schema.

[config.example.json]: config.example.json
[config.ts]: src/config.ts

### Usage

1. Install Node.js.

2. Clone the repository from Github and run the installation commands:

```sh
git clone https://github.com/Bannerets/keybase-export.git
cd keybase-export
npm install
npm run build
```

3. Copy `config.example.json` to `config.json` and edit it. At least, `chats`, `username` and `paperkey` should be replaced.

4. Launch:

```sh
$ ./bin/keybase-export
# or: $ node dist
```

Optionally, the configuration file can be passed as a cli argument:

```sh
$ ./bin/keybase-export config-2.json
```

Debug mode: `DEBUG=keybase-export* ./bin/keybase-export`

---

Another way to install is via NPM (not recommended, the version might be outdated):

```sh
npm install -g keybase-export
# local installation: $ npm install keybase-export
```

And launch:

```
$ keybase-export [<config>]
```
