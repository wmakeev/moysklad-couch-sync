'use strict'

const debug = require('debug')('couch-sync')
const db = require('project/nano-promise')

module.exports = function * couchSync (entities) {
  let keys = entities.map(ent => ent.uuid)

  // Устанавливаю существующие ревизии объектов
  let revs = (yield db.fetchRevs({ keys })).rows
  let docs = entities.map(ent => {
    let revValue = revs.find(rev => rev.key === ent.uuid && !rev.error && rev.value)
    let _ent = { _id: ent.uuid }
    if (revValue) { _ent._rev = revValue.value.rev }
    return Object.assign(_ent, ent)
  })

  let result = yield db.bulk({ docs })
  debug(result)

  return result
}
