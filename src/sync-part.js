'use strict'

const debug = require('debug')('sync-part')
const moment = require('moment')
const moysklad = require('moysklad-client')
const have = require('_project/have')

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
 * @returns {IterableIterator<ContinuationToken>} Обновленное состояние синхронизации
 */
module.exports = function * syncPart (syncToDB, loadAsync, entityType, step, continuationToken) {
  // Проверяем аргументы в runtime
  have(arguments, {
    syncToDB: 'function', loadAsync: 'function', type: 'string', step: 'number',
    continuationToken: 'continuationToken'
  })

  /** @type {Date} */
  let updatedTo
  /** @type {Entity} Последняя из полученных сущностей */
  let lastEntity
  /** @type {ContinuationToken} */
  let newToken

  let query = moysklad.createQuery()
    .filter('updated', { $gte: moment(continuationToken.updatedFrom).toDate() })
    .count(step)

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

  debug('continuationToken', continuationToken)

  /** @type {EntityCollection<Entity>} */
  let entities = yield loadAsync(entityType, query)

  debug('New entities:', entities.map(ent =>
    getServerTimeMoment(ent.updated).format('HH:mm:ss SSS')))

  if (!entities.length) { return continuationToken }

  lastEntity = entities[entities.length - 1]

  // Сохраняем в БД полученные сущности
  yield syncToDB(entities)

  // Получены все сущности для текущего интервала
  if (entities.total <= step) {
    debug(entityType + ' entities synced all')
    newToken = {
      updatedFrom: updatedTo.toISOString()
    }
  } else { // Получена только часть сущностей
    debug(entityType + ' entities to sync:', entities.total)
    newToken = {
      updatedFrom: continuationToken.updatedFrom,
      updatedTo: updatedTo.toISOString(),
      fromUuid: lastEntity.uuid
    }
  }

  return newToken
}
