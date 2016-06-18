'use strict'

const debug = require('debug')('sync-part')
const log = require('debug')('moysklad-couch-sync')
const moment = require('moment')
const moysklad = require('moysklad-client')
const have = require('_project/have')

const entityConverter = require('./entity-converter')

const SERVER_TIMEZONE = 180 // +3
const LOCAL_TIMEZONE = 300 // +5

function getServerTimeMoment (time) {
  time = time || new Date()
  let serverTimezone = time.originalTimezone || SERVER_TIMEZONE
  return moment(time).add(serverTimezone - LOCAL_TIMEZONE, 'm')
}

/**
 * Синхронизирует часть сущностей с БД
 * @param {function(Array<Entity>): Promise<any>} syncToDB Синхронизатор с БД
 * @param {function(string, Query): Promise<Array<Entity>>} loadAsync Загружает сущности МойСклад
 * @param {String} entityType Тип сущности МойСклад
 * @param {number} step Шаг синхронизации
 * @param {ContinuationToken} continuationToken Состояние синхронизации
 * @param {Object} config Настройки синхронизации
 * @returns {IterableIterator<ContinuationToken>} Обновленное состояние синхронизации
 */
module.exports = function * syncPart (syncToDB, loadAsync, entityType, step,
                                      continuationToken, config) {
  // Проверяем аргументы в runtime
  have(arguments, {
    syncToDB: 'function', loadAsync: 'function', type: 'string', step: 'number',
    continuationToken: 'continuationToken', config: 'opt obj'
  })

  let convertEntity = entityConverter(config)

  /** @type {Date} */
  let updatedTo
  /** @type {Entity} Последняя из полученных сущностей */
  let lastEntity
  /** @type {ContinuationToken} */
  let newToken

  let query = moysklad.createQuery()
    .filter('updated', { $gte: moment(continuationToken.updatedFrom).toDate() })
    .count(step)

  if (config && config.fileContent) {
    query = query.fileContent(true)
  }

  if (continuationToken.updatedTo) {
    if (moment(continuationToken.updatedTo).isAfter(getServerTimeMoment())) {
      return continuationToken
    }
    updatedTo = moment(continuationToken.updatedTo).toDate()
  } else {
    updatedTo = getServerTimeMoment().startOf('second').toDate()
  }

  query = query.filter('updated', { $lt: updatedTo })

  if (continuationToken.fromUuid) {
    query = query.filter('uuid', { $gt: continuationToken.fromUuid })
  }

  debug('continuationToken:', continuationToken)

  /** @type {EntityCollection<Entity>} */
  let entities = yield loadAsync(entityType, query)

  entities = entities.map(convertEntity)

  debug('New entities:', entities.map(ent =>
    getServerTimeMoment(ent.updated).format('HH:mm:ss SSS')))

  if (!entities.length) {
    if (continuationToken.updatedTo || continuationToken.fromUuid) {
      return Object.assign({}, continuationToken, {
        updatedFrom: updatedTo.toISOString(),
        updatedTo: null,
        fromUuid: null,
        remaining: 0
      })
    } else {
      return continuationToken
    }
  }

  lastEntity = entities[entities.length - 1]

  // Сохраняем в БД полученные сущности
  yield syncToDB(entities)

  newToken = Object.assign({}, continuationToken)

  // Получены все сущности для текущего интервала
  if (entities.total <= step) {
    log(`[${entityType}] synced ${entities.length} entities`)
    Object.assign(newToken, {
      updatedFrom: updatedTo.toISOString(),
      updatedTo: null,
      fromUuid: null,
      remaining: 0
    })
  } else { // Получена только часть сущностей
    log(`[${entityType}] synced ${entities.length} of ${entities.total} entities`)
    Object.assign(newToken, {
      updatedFrom: continuationToken.updatedFrom,
      updatedTo: updatedTo.toISOString(),
      fromUuid: lastEntity.uuid,
      remaining: entities.total - entities.length
    })
  }

  return newToken
}
