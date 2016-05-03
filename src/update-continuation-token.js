'use strict'

module.exports = continuationToken =>
  updated => updated instanceof Date
    ? Object.assign({}, continuationToken, { updated })
    : Object.assign({}, continuationToken, updated)
