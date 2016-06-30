'use strict'

require('dotenv').config()
process.env.DEBUG = '*'

let tap = require('tap')
let reporter = require('tap-mocha-reporter')
let walk = require('walkdir')

let testFilePattern = /__tests__[\/\\]+.+-test\.js$/i

tap.unpipe(process.stdout)
tap.pipe(reporter('spec'))

walk.sync('src', function (path, stat) {
  if (testFilePattern.test(path)) {
    let testModule = require(path)
    Object.keys(testModule).forEach(testName => {
      tap.test(testName, testModule[testName])
    })
  }
})
