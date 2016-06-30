'use strict'

const log = require('debug')('moysklad-couch-sync-diff')
const jsonDiffFormat = require('jsondiffpatch').formatters.console.format

const nano = require('_project/nano-promise')
const entityDiff = require('_project/entity-diff')

const couch = nano(process.env.COUCHDB_HOST)
const entitiesDb = couch.db.use(process.env.COUCHDB_MOYSKLAD_ENTITIES_DB)
const changesDb = couch.db.use(process.env.COUCHDB_MOYSKLAD_CHANGES_DB)

/**
 * @param {Entity} entity Сущность
 * @param {any} delta Diff delta
 * @returns {EntityDiff} EntityDiff
 */
let getDiffObject = (entity, delta) => ({
  TYPE_NAME: entity.TYPE_NAME,
  uuid: entity.uuid,
  updatedBy: entity.updatedBy,
  delta
})

/**
 * Синхронизирует сущности МойСклад с БД CouchDB
 * @param {Array<TransformedEntity>} entities Список сущностей
 * @returns {Promise} db.bulk
 */
module.exports = function * couchSync (entities) {
  /** @type {CouchDBDocsList<CouchEntity>} */
  let dbFetchResult = yield entitiesDb.fetch({ keys: entities.map(ent => ent.uuid) })
  /** @type {Array<CouchEntity>} */
  let rows = dbFetchResult.rows
  /** @type {Array<CouchEntity>} */
  let couchEntities = []
  /** @type {Array<EntityDiff>} */
  let diffs = []

  let messages = entities.map((entity, index) => {
    let diff
    let row = rows[index]
    let ent = { _id: entity.uuid }
    let msg
    if (row && row.value && row.doc && !row.error) {
      diff = getDiffObject(entity, entityDiff.diff(row.doc, entity))
      ent._rev = row.value.rev
      msg = `[${diff.TYPE_NAME}] ${entity.name} changed by ${diff.updatedBy}:\n` +
        jsonDiffFormat(diff.delta)
    } else {
      diff = getDiffObject(entity, entityDiff.diff(null, entity))
      msg = `[${diff.TYPE_NAME}] ${entity.name} created by ${diff.updatedBy}`
    }

    if (diff.delta) {
      couchEntities.push(Object.assign(ent, entity))
      diffs.push(diff)
      return msg
    } else {
      return `[${diff.TYPE_NAME}] ${entity.name} already synced`
    }
  })

  // TODO Важно убедится в том что данные сохранились в changesDb и entitiesDb одновременно ..
  // .. иначе отменить, если возможно

  if (diffs.length) {
    entitiesDb.bulk({ docs: couchEntities })
    changesDb.bulk({ docs: diffs })
  }

  log(['CHANGES:'].concat(messages).join('\n'))

  return void 0
}
