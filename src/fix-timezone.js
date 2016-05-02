'use strict'

let moment = require('moment')

let msServerTimezone = 4
let timezone = -6
let timezoneFix = msServerTimezone + timezone

module.exports = function fixTimezone (time) {
  moment(time).add(timezoneFix, 'hour').toDate()
}
