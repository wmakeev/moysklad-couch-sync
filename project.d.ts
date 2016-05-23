interface CouchDBView<T> {
    key: string
    id?: string
    value?: T
    error?: string
}

interface CouchDBList<T> {
    offset: number
    rows: Array<CouchDBView<T>>
    total_rows: number;
}

/**
 * Запись в базе данных CouchDB
 */
interface CouchDBDoc {
    /** Идентификатор токена в базе базе данных CouchDB */
    _id: string
    /** Ревизия токена в базе базе данных CouchDB */
    _rev: string
}

/**
 * Токен указывающий на точку где была приостановлена очередная итерация синхронизация
 */
interface ContinuationToken extends CouchDBDoc {
    /** Тип объекта */
    TYPE_NAME: string
    /** Дата в формате UTC с которой должна быть начата следующая итерация синхронизации */
    updatedFrom: string
    /** Дата в формате UTC до которой должна быть завершена синхронизация */
    updatedTo?: string
    /** Идентификатор на котором была приостановлена прошлая итерация синхронизации */
    fromUuid?: string
    /** Кол-во сущностей которые осталось синхронизировать */
    remaining?: number
    /** Время между итерациями */
    timeout?: number
}

/**
 * Сущность МойСклад
 */
interface Entity {
    TYPE_NAME: string
    uuid: string
    name: string
    updated: Date
}

interface EntityCollection<T> extends ArrayLike<T> {
    total: number
    start: number
    count: number
}

interface Query {}

interface CouchEntity extends Entity, CouchDBDoc {}

declare module "_project/nano-promise" {

    /** Возвращает список ревизий для объектов с указанными ключами */
    export function fetchRevs(query: { keys: Array<string> }): Promise<CouchDBList<{ rev: string }>>

}