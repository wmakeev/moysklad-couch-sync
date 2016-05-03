'use strict'

let have = require('project/have')
let debug = require('debug')('sync-part')
let moment = require('moment')
let moysklad = require('moysklad-client')

let fixTimezone = require('./fix-timezone')
let syncPartBySeconds = require('./sync-part-by-seconds')
let updateContinuationToken = require('./update-continuation-token')

module.exports = function * syncPart (syncToDB, loadAsync, type, step, continuationToken) {
  have(arguments, {
    syncToDB: 'function', loadAsync: 'function', type: 'string', step: 'number',
    continuationToken: 'continuationToken'
  })

  debug('continuationToken', continuationToken.updated)

  let entitiesToSync
  let lastEntity
  let lastUpdatedStart
  let lastUpdatedEnd

  let updateToken = updateContinuationToken(continuationToken)

  let query = moysklad.createQuery()
    .filter('updated', { $gt: fixTimezone(continuationToken.updated) })
    .orderBy('updated')
    .count(step)

  let requestTime = new Date()
  let entities = yield loadAsync(type, query)
  debug('New entities:', entities.map(ent => moment(ent.updated).format('HH:mm:ss SSS')))

  if (!entities.length) { return continuationToken }

  lastEntity = entities[entities.length - 1]
  lastUpdatedStart = moment(lastEntity.updated).startOf('second').toDate()
  entitiesToSync = entities.filter(ent => ent.updated <= lastUpdatedStart)

  if (entities.length < step) {
    // Получены самые последние обновления
    lastUpdatedEnd = moment(lastEntity.updated)
      .startOf('second').add(1, 'second').toDate()
    if (requestTime < lastUpdatedEnd) {
      // Запрос был в ту же секунду что и посление обновления
      if (entitiesToSync.length) {
        yield syncToDB(entitiesToSync)
        return updateToken(lastUpdatedStart)
      } else {
        // Повторяем запрос снова чтобы при следующем запросе эта секунда была в прошлом
        debug('Skip this iteration')
        return continuationToken
      }
    } else {
      yield syncToDB(entities)
      return updateToken(lastUpdatedEnd)
    }
  } else {
    // Получена только часть обновлений
    if (entitiesToSync.length) {
      yield syncToDB(entitiesToSync)
      return updateToken(lastUpdatedStart)
    } else {
      return yield syncPartBySeconds(syncToDB, loadAsync, type, step,
        updateToken(moment(entities[0].updated).startOf('second').toDate()))
    }
  }
}
