'use strict'

const co = require('co')
// const debug = require('debug')('main')
const log = require('debug')('moysklad-couch-sync')
const moysklad = require('moysklad-client')

const db = require('_project/nano-promise')
const getSyncWorker = require('./sync-worker')

const SYNC_STEP = 100

let client = moysklad.createClient()
let syncWorker = getSyncWorker(client)

co(function * () {
  /** @type {CouchDBList<ContinuationToken>} */
  let continuationTokens = (yield db.view('views', 'sync-token'))

  /** @type {Map<string, ContinuationToken>} */
  let continuationTokensMap = continuationTokens.rows.reduce((res, row) => {
    res.set(row.key, Object.assign({}, row.value))
    return res
  }, new Map())

  continuationTokensMap.forEach((token, type) => {
    co(function * () {
      yield syncWorker(type, token, SYNC_STEP)
    }).catch(err => {
      log(`[${type}] worker stoped with error: ${err.message}`, err.stack)
    })
  })
}).then(res => console.log('Watching for changes ..'))
  .catch(err => console.log('Sync failed with error: ' + err.message, err.stack))
