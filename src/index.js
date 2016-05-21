'use strict'

const co = require('co')
const debug = require('debug')('main')
const moment = require('moment')
const moysklad = require('moysklad-client')

const syncPart = require('./sync-part')
const couchSync = require('./couch-sync')
const db = require('_project/nano-promise')

const WAIT_TIME = 60000
const SYNC_STEP = 100

let client = moysklad.createClient()

/**
 * Синхронизирует сущности с базой данных
 * @param {Array<Entity>} entities Список сущностей
 * @returns {Iterable} db.bulk
 */
function * syncToDB (entities) {
  console.log('syncToDB', entities.map(ent =>
    ent.name.substring(0, 50) + ' ' + moment(ent.updated).format('HH:mm:ss.SSS')))
  yield couchSync(entities)
}

/**
 * Асинхронная обертка для client.load
 * @param {string} type Тип сущности
 * @param {Query} query Запрос
 * @returns {PromiseLike} Promise
 */
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

/**
 * Асинхронный wait
 * @param {number} time Время (мс)
 * @returns {PromiseLike} Promise
 */
function wait (time) {
  return new Promise(resolve => setTimeout(resolve, time))
}

/**
 * Синхронизирует часть сущностей
 * @param {string} type Тип сущности
 * @param {ContinuationToken} continuationToken Тип сущности
 * @param {number} step Кол-во синхронизируемых сущностей для текущей итерации
 * @returns {Iterable} undefined
 */
function * syncWorker (type, continuationToken, step) {
  let currentToken = continuationToken
  let nextToken
  let tokenRev

  while (true) {
    debug(`syncWorker type: ${type} | updatedFrom: ${moment(currentToken.updatedFrom)
      .format('HH:mm:ss SSS')}`)
    nextToken = yield syncPart(syncToDB, loadAsync, type, step, currentToken)
    if (nextToken !== currentToken) {
      // TODO Constructor
      currentToken = Object.assign({
        _id: 'syncToken:' + type,
        _rev: currentToken._rev,
        TYPE_NAME: 'config.syncToken'
      }, nextToken)
      tokenRev = yield db.insert(currentToken)
      debug('Token updated ' + tokenRev.rev)
      currentToken._rev = tokenRev.rev
    }
    yield wait(WAIT_TIME)
  }
}

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
      console.log(`Error in worker (${type}):`, err.stack)
    })
  })
}).then(res => console.log('Sync started ..'))
  .catch(err => console.log(err.stack))
