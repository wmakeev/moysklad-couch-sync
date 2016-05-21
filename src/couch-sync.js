'use strict'

// const debug = require('debug')('couch-sync')
const db = require('_project/nano-promise')

/**
 * Синхронизирует сущности МойСклад с БД CouchDB
 * @param {Array<Entity>} entities Список сущностей
 * @returns {Promise} db.bulk
 */
module.exports = function couchSync (entities) {
  let keys = entities.map(ent => ent.uuid)

  // Устанавливаю существующие ревизии объектов
  return db.fetchRevs({ keys }).then(res => {
    let revs = res.rows
    /** @type Array<CouchEntity> */
    let docs = entities.map(ent => {
      let revValue = revs.find(rev => !rev.error && rev.key === ent.uuid && rev.value)
      let _ent = { _id: ent.uuid }
      if (revValue) { _ent._rev = revValue.value.rev }
      return Object.assign(_ent, ent)
    })
    return db.bulk({ docs })
  })
}
