'use strict'

const co = require('co')
const log = require('debug')('moysklad-couch-sync')
const moysklad = require('moysklad-client')

const nano = require('_project/nano-promise')
const getSyncWorker = require('./sync-worker')

const { COUCHDB_HOST, COUCHDB_MOYSKLAD_ENTITIES_DB, SYNC_STEP } = process.env

const couch = nano(COUCHDB_HOST)
const db = couch.db.use(COUCHDB_MOYSKLAD_ENTITIES_DB)

let client = moysklad.createClient()
let syncWorker = getSyncWorker(client)

co(function * () {
  /** @type {CouchDBDoc} */
  let syncConfig
  /** @type {CouchDBViewList<ContinuationToken>} */
  let continuationTokens

  ;[syncConfig, continuationTokens] = yield Promise.all([
    db.get('sync-config'), db.view('utils', 'sync-token')
  ])

  /** @type {Map<string, ContinuationToken>} */
  let continuationTokensMap = continuationTokens.rows.reduce((res, row) => {
    res.set(row.key, Object.assign({}, row.value))
    return res
  }, new Map())

  continuationTokensMap.forEach((token, type) => {
    co(function * () {
      yield syncWorker(type, token, SYNC_STEP, syncConfig[type] || {})
    }).catch(err => {
      log(`[${type}] worker stoped with error: ${err.message}`, err.stack)
    })
  })
}).then(res => console.log('Watching for changes ..'))
  .catch(err => console.log('Sync failed: ' + err.message, err.stack))
