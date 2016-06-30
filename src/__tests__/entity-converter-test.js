/* eslint no-shadow: 0 */
'use strict'

const compose = require('lodash.compose')

// reducers
const entitiesArrayToObject = require('_project/reducers/entities-array-to-object')
const jsonAttachmentExpand = require('_project/reducers/json-attachment-expand')
const nonJsonContentsRemove = require('_project/reducers/non-json-contents-remove')
const reducer = compose(
  entitiesArrayToObject,
  jsonAttachmentExpand,
  nonJsonContentsRemove)

let entityConverter = require('../entity-converter')(reducer)

exports['Entity converter'] = t => {
  let updated = new Date()
  let moment = new Date()
  moment.some = 'foo'

  let entity = {
    name: 'foo',
    uuid: 'some-uuid',
    updated,
    moment,
    someArray: [1, 2, 3],
    entityArray: [
      { name: 'ent-1', uuid: 'ent-1-uuid' },
      { name: 'ent-2', uuid: 'ent-2-uuid' },
      { name: 'ent-3', uuid: 'ent-3-uuid' }
    ],
    objProp: {
      entitySubArray: [
        { name: 'sub-ent-1', uuid: 'sub-ent-1-uuid' },
        { name: 'sub-ent-2', uuid: 'sub-ent-2-uuid' },
        { name: 'sub-ent-3', uuid: 'sub-ent-3-uuid' }
      ]
    },
    attrs: [
      {
        uuid: 'attr-1-uuid', metadataUuid: 'attr-1-meta-uuid',
        file: {
          filename: 'some-1.jpg'
        }
      },
      {
        uuid: 'attr-2-uuid', metadataUuid: 'attr-2-meta-uuid',
        file: {
          TYPE_NAME: 'moysklad.attachmentDocument',
          filename: 'some-2.jpg',
          contents: 'none'
        }
      },
      {
        uuid: 'attr-3-uuid', metadataUuid: 'attr-3-meta-uuid',
        file: {
          TYPE_NAME: 'moysklad.attachmentDocument',
          filename: 'some-3.json',
          contents: 'WwogICJmcm9udCIsCiAgIm1hbjEiCl0='
        }
      }
    ],
    images: [
      {
        TYPE_NAME: 'moysklad.goodImage',
        uuid: 'image-1-uuid',
        filename: '12757.jpg',
        contents: 'some-content'
      }
    ]
  }

  let convertedEntity = {
    name: 'foo',
    uuid: 'some-uuid',
    updated: updated.toISOString(),
    moment: moment.toISOString(),
    someArray: [1, 2, 3],
    entityArray: {
      'ent-1-uuid': { name: 'ent-1', uuid: 'ent-1-uuid', _index: 0 },
      'ent-2-uuid': { name: 'ent-2', uuid: 'ent-2-uuid', _index: 1 },
      'ent-3-uuid': { name: 'ent-3', uuid: 'ent-3-uuid', _index: 2 },
      _array: true
    },
    objProp: {
      entitySubArray: {
        'sub-ent-1-uuid': { name: 'sub-ent-1', uuid: 'sub-ent-1-uuid', _index: 0 },
        'sub-ent-2-uuid': { name: 'sub-ent-2', uuid: 'sub-ent-2-uuid', _index: 1 },
        'sub-ent-3-uuid': { name: 'sub-ent-3', uuid: 'sub-ent-3-uuid', _index: 2 },
        _array: true
      }
    },
    attrs: {
      'attr-1-meta-uuid': {
        uuid: 'attr-1-uuid', metadataUuid: 'attr-1-meta-uuid',
        file: {
          filename: 'some-1.jpg'
        }
      },
      'attr-2-meta-uuid': {
        uuid: 'attr-2-uuid', metadataUuid: 'attr-2-meta-uuid',
        file: {
          TYPE_NAME: 'moysklad.attachmentDocument',
          filename: 'some-2.jpg'
        }
      },
      'attr-3-meta-uuid': {
        uuid: 'attr-3-uuid', metadataUuid: 'attr-3-meta-uuid',
        file: {
          TYPE_NAME: 'moysklad.attachmentDocument',
          filename: 'some-3.json',
          contents: ['front', 'man1']
        }
      },
      _array: true
    },
    images: {
      'image-1-uuid': {
        TYPE_NAME: 'moysklad.goodImage',
        uuid: 'image-1-uuid',
        filename: '12757.jpg',
        _index: 0
      },
      _array: true
    }
  }

  entityConverter(entity).then(converted => {
    t.deepEqual(converted, convertedEntity, 'should properly convert entity')
    t.end()
  })
}
