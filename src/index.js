'use strict'

const co = require('co')
const debug = require('debug')('main')
const moment = require('moment')
const moysklad = require('moysklad-client')

const syncPart = require('./sync-part')
const couchSync = require('./couch-sync')
const db = require('project/nano-promise')

const WAIT_TIME = 2000
const SYNC_STEP = 10

let syncToDB = function * (entities) {
  console.log('syncToDB', entities.map(ent =>
    ent.name.substring(0, 50) + ' ' + moment(ent.updated).format('HH:mm:ss.SSS')))
  yield couchSync(entities)
}

let client = moysklad.createClient()

function loadAsync (type, query) {
  return new Promise((resolve, reject) => {
    client.load(type, query, function (err, data) {
      if (err) {
        reject(err)
      } else {
        resolve(data)
      }
    })
  })
}

function wait (time) {
  return new Promise(resolve => setTimeout(resolve, time))
}

function * syncWorker (type, continuationToken, step) {
  let currentToken = continuationToken
  let nextToken
  let nextTokenRev

  while (true) {
    debug(`syncWorker type: ${type} | updated: ${moment(currentToken.updated)
      .format('HH:mm:ss SSS')}`)
    nextToken = yield syncPart(syncToDB, loadAsync, type, step, currentToken)
    if (nextToken !== currentToken) {
      nextTokenRev = yield db.insert(nextToken)
      debug('Token updated ' + nextTokenRev.rev)
      currentToken = Object.assign({}, nextToken, { _rev: nextTokenRev.rev })
    }
    yield wait(WAIT_TIME)
  }
}

co(function * () {
  let continuationTokensMap = (yield db.view('views', 'sync-token')).rows.reduce((res, row) => {
    res.set(row.key, Object.assign({}, row.value, { updated: new Date(row.value.updated) }))
    return res
  }, new Map())

  continuationTokensMap.forEach((token, type) => {
    co(function * () {
      yield syncWorker(type, token, SYNC_STEP)
    }).catch(err => {
      console.log(`Error in worker (${type}):`, err.stack)
    })
  })
}).then(res => console.log('Started'))
  .catch(err => console.log(err.stack))
