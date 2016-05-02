'use strict'

let have = require('project/have')
let debug = require('debug')('sync-part')
let moment = require('moment')
let moysklad = require('moysklad-client')

let fixTimezone = require('./fix-timezone')
let syncPartBySeconds = require('./sync-part-by-seconds')

module.exports = function * syncPart (syncToDB, loadAsync, type, step, continuationToken) {
  have(arguments, {
    syncToDB: 'function', loadAsync: 'function', type: 'string', step: 'number',
    continuationToken: 'continuationToken'
  })

  debug(continuationToken)

  let entitiesToSync
  let lastEntity
  let lastUpdatedStart
  let lastUpdatedEnd

  let query = moysklad.createQuery()
    .filter('updated', { $gt: fixTimezone(continuationToken.updated) })
    .orderBy('updated')
    .count(step)

  let requestTime = new Date()
  let entities = yield loadAsync(type, query)
  debug(entities.map(ent => moment(ent.updated).format('HH:mm:ss SSS')))

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
      if (entitiesToSync) {
        syncToDB(entitiesToSync)
        return { updated: lastUpdatedStart }
      } else {
        // Повторяем запрос
        return { updated: continuationToken.updated }
      }
    } else {
      syncToDB(entities)
      return { updated: lastUpdatedEnd }
    }
  } else {
    // Получена только часть обновлений
    if (entitiesToSync.length) {
      syncToDB(entitiesToSync)
      return { updated: lastUpdatedStart }
    } else {
      return yield syncPartBySeconds(syncToDB, type, step, {
        updated: moment(entities[0].updated).startOf('second').toDate()
      })
    }
  }
}
