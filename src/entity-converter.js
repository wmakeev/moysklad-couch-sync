'use strict'

const reduce = require('lodash.reduce')

/**
 * Возвращает конвертер для сущностей МойСклад
 * @param {Function} reducer Преобразователь объекта
 * @returns {convertEntity} Конвертер
 */
module.exports = function getEntityConverter (reducer) {
  let reduceEntity = value => new Promise(resolve => reducer(resolve)(value))
  /**
   * Преобразует сущность МойСклад к формату удобному для хранения в CouchDB
   * @param {Entity} entity Сущность МойСклад
   * @returns {PromiseLike<TransformedEntity>} Преобразованная сущность МойСклад
   */
  function convertEntity (entity) {
    return reduce(entity, (result, value, key) => result.then(res =>
      (value instanceof Object
        ? convertEntity(value).then(reduceEntity)
        : reduceEntity(value)).then(reducedValue => {
          res[key] = reducedValue
          return res
        })),
      Promise.resolve(entity instanceof Array ? [] : {})).then(reduceEntity)
  }

  return entity => convertEntity(JSON.parse(JSON.stringify(entity)))
}
