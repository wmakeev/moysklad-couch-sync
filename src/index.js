'use strict'

let co = require('co')
let debug = require('debug')('main')
let moment = require('moment')
let moysklad = require('moysklad-client')

let syncPart = require('./sync-part')
let couchSync = require('./couch-sync')

let syncToDB = function * (entities) {
  yield couchSync(entities)
  console.log(entities.map(ent =>
    ent.name.substring(0, 50) + ' ' + moment(ent.updated).format('HH:mm:ss.SSS')))
}

let client = moysklad.createClient()

function loadAsync (type, query) {
  return new Promise((resolve, reject) => {
    client.load(type, query, function (err, data) {
      if (err) {
        reject(err)
      } else {
        resolve(data)
      }
    })
  })
}

function wait (time) {
  return new Promise(resolve => setTimeout(resolve, time))
}

co(function * () {
  let continuationToken = {
    updated: new Date(2016, 4, 1, 22, 24, 53)
  }
  while (true) {
    debug(`[${moment(continuationToken.updated).format('HH:mm:ss SSS')}]`)
    continuationToken = yield syncPart(syncToDB, loadAsync, 'internalOrder', 3, continuationToken)
    yield wait(2000)
  }
}).catch(err => {
  console.log(err.stack)
})
