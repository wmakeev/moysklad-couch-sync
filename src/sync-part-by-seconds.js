'use strict'

let have = require('project/have')
let debug = require('debug')('sync-part-by-seconds')
let moment = require('moment')
let moysklad = require('moysklad-client')

let fixTimezone = require('./fix-timezone')

module.exports = function * syncPartBySeconds (syncToDB, loadAsync, type, step, continuationToken) {
  have(arguments, {
    syncToDB: 'function', loadAsync: 'function', type: 'string', step: 'number',
    continuationToken: 'continuationToken'
  })

  debug(continuationToken)

  let nextSecond = moment(continuationToken.updated)
    .startOf('second').add(1, 'second').toDate()

  let query = moysklad.createQuery()
    .select({
      // TODO На момент запроса секундный интервал должен быть в прошлом
      updated: {
        $gt: fixTimezone(continuationToken.updated),
        $lte: fixTimezone(nextSecond)
      }
    })

  if (continuationToken.uuid) {
    query = query.filter('uuid', { $gt: continuationToken.uuid })
  }

  query = query.count(step)

  let entities = yield loadAsync(type, query)
  debug(entities.map(ent => moment(ent.updated).format('HH:mm:ss SSS')))

  // TODO Может быть и без yeild но как обрабатывать ошибки?
  yield syncToDB(entities)

  if (entities.length < step) {
    return { updated: nextSecond }
  } else {
    return yield syncPartBySeconds(syncToDB, type, step, {
      updated: continuationToken.updated,
      uuid: entities[entities.length - 1].uuid
    })
  }
}
