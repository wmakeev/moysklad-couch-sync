/**
 * Возвращает конвертер для сущностей МойСклад
 * @param {Object} options Опции
 * @returns {convertEntity} Конвертер
 */
module.exports = function getEntityConverter (options) {
  /**
   * Преобразует сущность МойСклад к формату удобному для хранения в CouchDB
   * @param {Entity} entity Сущность МойСклад
   * @returns {Entity} Преобразованная сущность МойСклад
   */
  function convertEntity (entity) {
    return Object.keys(entity).reduce((res1, key) => {
      let curProp = entity[key]
      let keyProp = 'uuid'
      if (curProp instanceof Array && curProp[0] && curProp[0][keyProp]) {
        keyProp = ['metadataUuid', 'priceTypeUuid'].find(p => !!curProp[0][p]) || keyProp
        res1[key] = curProp.reduce((res2, item, index) => {
          item._index = index
          res2[item[keyProp]] = item instanceof Object ? convertEntity(item) : item
          return res2
        }, {_array: true})
      } else {
        res1[key] = entity[key]
      }
      return res1
    }, {})
  }

  return convertEntity
}
