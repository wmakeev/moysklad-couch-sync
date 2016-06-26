interface CouchDBErrorRow {
    key: string
    error: string
}

interface CouchDBRow {
    key: string
    id: string
}

interface CouchDBValueRow<T> extends CouchDBRow {
    value: T
}

interface CouchDBDocRow<T> extends CouchDBValueRow<{ rev: string }> {
    doc: T
}

interface CouchDBList<T> {
    offset: number
    rows: Array<T|CouchDBErrorRow>
    total_rows: number
}

interface CouchDBViewList<T> extends CouchDBList<CouchDBValueRow<T>> {}

interface CouchDBDocsList<T> extends CouchDBList<CouchDBDocRow<T>> {}

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

interface TransformedEntity extends Entity {}

interface EntityCollection<T> extends ArrayLike<T> {
    total: number
    start: number
    count: number
}

interface Query {}

interface CouchEntity extends Entity, CouchDBDoc {}

declare module "_project/nano-promise" {

    function nanoPromise (host: string): {
        db: {
            use (name: string): {

                /** Возвращает список документов для запроса `query` */
                fetch(query: { keys: Array<string> }): Promise<CouchDBDocsList<CouchEntity>>,

                /** Возвращает список ревизий для объектов с указанными ключами */
                fetchRevs(query: { keys: Array<string> }): Promise<CouchDBViewList<{ rev: string }>>
            }
        }
    }

    export = nanoPromise
}