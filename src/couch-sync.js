'use strict'

// const assert = require('assert')
const log = require('debug')('diff')
const jsonDiffFormat = require('jsondiffpatch').formatters.console.format

const nano = require('_project/nano-promise')
const entityDiff = require('_project/entity-diff')

const couch = nano(process.env.COUCHDB_HOST)
const db = couch.db.use(process.env.COUCHDB_MOYSKLAD_DB)
const changesDb = couch.db.use(process.env.COUCHDB_MOYSKLAD_CHANGES_DB)

/* Клонирует объект */
let clone = obj => JSON.parse(JSON.stringify(obj))

/* Подготавливает объект к сравнению */
let cloneToDiff = obj => {
  let cloned = clone(obj)
  return Object.keys(cloned).reduce((res1, key) => {
    let prop = cloned[key]
    let keyProp = 'uuid'
    if (prop instanceof Array && prop[0] && prop[0][keyProp]) {
      keyProp = ['metadataUuid', 'priceTypeUuid'].find(p => !!prop[0][p]) || keyProp
      res1[key] = prop.reduce((res2, item, index) => {
        item._index = index // TODO Нужно ли сохранять индекс?
        res2[item[keyProp]] = item instanceof Object ? cloneToDiff(item) : item
        return res2
      }, { _array: true })
    } else {
      res1[key] = cloned[key]
    }
    return res1
  }, {})
}

/* Возвращает объект с измененимями для фиксации в БД */
let getDiffObject = (entity, delta) => ({
  TYPE_NAME: entity.TYPE_NAME,
  name: entity.name,
  uuid: entity.uuid,
  updatedBy: entity.updatedBy,
  delta
})

/**
 * Синхронизирует сущности МойСклад с БД CouchDB
 * @param {Array<Entity>} entities Список сущностей
 * @returns {Promise} db.bulk
 */
module.exports = function couchSync (entities) {
  let keys = entities.map(ent => ent.uuid)

  // Устанавливаю существующие ревизии объектов
  return db.fetch({ keys }).then(res => {
    let rows = res.rows
    let diffs = []
    /** @type Array<CouchEntity> */
    let docs = entities.map((entity, index) => {
      let diff
      let row = rows[index]
      let _ent = { _id: entity.uuid }
      if (row && row.value && !row.error) {
        // assert(entity.uuid === row.doc.uuid, 'Uuids mismatch!') // TODO Временно для отладки
        diff = getDiffObject(entity, entityDiff.diff(cloneToDiff(row.doc), cloneToDiff(entity)))
        log(`[${diff.TYPE_NAME}] ${diff.name} changed by ${diff.updatedBy}:\n`, jsonDiffFormat(diff.delta))
        _ent._rev = row.value.rev
      } else {
        diff = getDiffObject(entity, entityDiff.diff({}, cloneToDiff(entity)))
      }
      diffs.push(diff)
      return Object.assign(_ent, entity)
    })
    if (diffs.length) {
      changesDb.bulk({ docs: diffs })
    }
    return db.bulk({ docs })
  })
}
