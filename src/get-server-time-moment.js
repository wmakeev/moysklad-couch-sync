const moment = require('moment')

const SERVER_TIMEZONE = parseInt(process.env.MOYSKLAD_SERVER_TIMEZONE) || 180
const LOCAL_TIMEZONE = process.env.LOCAL_TIMEZONE || -(new Date()).getTimezoneOffset()

/**
 * Возвращает время сервера
 * @param {Date} [localTime] Местное время
 * @returns {moment.Moment} Время сервера в формате Moment
 */
module.exports = function getServerTimeMoment (localTime) {
  localTime = localTime || new Date()
  let serverTimezone = localTime.originalTimezone || SERVER_TIMEZONE
  return moment(localTime).add(serverTimezone - LOCAL_TIMEZONE, 'm')
}
