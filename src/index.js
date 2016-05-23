'use strict'

const co = require('co')
const debug = require('debug')('main')
const log = require('debug')('moysklad-couch-sync')
const moment = require('moment')
const moysklad = require('moysklad-client')

const syncPart = require('./sync-part')
const couchSync = require('./couch-sync')
const db = require('_project/nano-promise')

const DEFAULT_TIMEOUT = process.env.DEFAULT_TIMEOUT || 60000
const SYNC_STEP = 100

let client = moysklad.createClient()

/**
 * Синхронизирует сущности с базой данных
 * @param {Array<Entity>} entities Список сущностей
 * @returns {Iterable} db.bulk
 */
function * syncToDB (entities) {
  /* console.log('syncToDB', entities.map(ent =>
    ent.name.substring(0, 50) + ' ' + moment(ent.updated).format('HH:mm:ss.SSS'))) */
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
  /** @type {ContinuationToken} */
  let currentToken = continuationToken
  /** @type {ContinuationToken} */
  let nextToken

  log(`[${type}] worker started ..`)

  while (true) {
    debug(`[${type}] sync worker iteration updatedFrom: ${moment(currentToken.updatedFrom)
      .format('HH:mm:ss SSS')}`)

    nextToken = yield syncPart(syncToDB, loadAsync, type, step, currentToken)

    if (nextToken !== currentToken) {
      nextToken._rev = (yield db.insert(nextToken)).rev
      debug('Token updated ' + nextToken._rev)
      currentToken = nextToken
    }

    if (!currentToken.updatedTo) {
      yield wait(continuationToken.timeout || DEFAULT_TIMEOUT)
    }
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
      log(`[${type}] worker stoped with error:`, err.stack)
    })
  })
}).then(res => console.log('Watching for changes ..'))
  .catch(err => console.log(err.stack))
