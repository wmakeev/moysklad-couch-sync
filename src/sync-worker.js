const syncPart = require('./sync-part')
const debug = require('debug')('sync-worker')
const log = require('debug')('moysklad-couch-sync')
const moment = require('moment')

const wait = require('_project/wait')
const db = require('_project/nano-promise')
const couchSync = require('./couch-sync')

/** @type {number} Таймаут по умолчанию между проверками обновлений */
const DEFAULT_TIMEOUT = process.env.DEFAULT_TIMEOUT || 60000
/** @type {number} Кол-во попыток повторного запроса при получении ошибки обращения к МойСклад */
const ERRORS_LIMIT = 5
/** @type {number} Таймаут по умолчанию между повторами (10 сек) */
const ERROR_TIMEOUT = 1000 * 10
/** @type {number} Таймаут между повторами во время технических работ (10 мин) */
const ERROR_502_TIMEOUT = 1000 * 60 * 10

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
 * Возвращает syncWorker для определенного экземпляра клиента
 * @param {Client} client Экземпляр moysklad-client
 * @returns {function(string, ContinuationToken, number):IterableIterator} syncWorker
 */
module.exports = function getSyncWorker (client) {
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
   * Синхронизирует часть сущностей
   * @param {string} type Тип сущности
   * @param {ContinuationToken} continuationToken Тип сущности
   * @param {number} step Кол-во синхронизируемых сущностей для текущей итерации
   * @returns {IterableIterator} some
   */
  function * syncWorker (type, continuationToken, step) {
    /** @type {ContinuationToken} */
    let currentToken = continuationToken
    /** @type {ContinuationToken} */
    let nextToken = currentToken
    /** @type {number} */
    let timeout = continuationToken.timeout || DEFAULT_TIMEOUT
    /** @type {Array<Error>} */
    let errors = []

    log(`[${type}] worker started | timeout ${timeout / 1000}s | step ${step} ..`)

    while (true) {
      debug(`[${type}] sync worker iteration updatedFrom: ${moment(currentToken.updatedFrom)
        .format('HH:mm:ss SSS')}`)

      try {
        nextToken = yield syncPart(syncToDB, loadAsync, type, step, currentToken)
      } catch (err) {
        if (errors.length >= ERRORS_LIMIT) {
          throw err
        } else if (err.message && err.message.indexOf('Server response error 502') !== -1) {
          yield wait(ERROR_502_TIMEOUT)
        } else {
          log(err.message)
          yield wait(ERROR_TIMEOUT)
        }
        errors.push(err)
        continue
      }
      errors = []

      if (nextToken !== currentToken) {
        nextToken._rev = (yield db.insert(nextToken)).rev
        debug('Token updated ' + nextToken._rev)
        currentToken = nextToken
      }

      if (!currentToken.updatedTo) {
        yield wait(timeout)
      }
    }
  }

  return syncWorker
}
