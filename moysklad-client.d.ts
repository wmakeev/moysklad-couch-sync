declare module "moysklad-client" {

  interface IMoyskladEntity {
    TYPE_NAME: string
  }

  export class Query {
    filter(name: string, value: string): Query
    orderBy(field: string): Query
    count(): number
    count(count: number): Query
  }

  export class Client {
    load<T>(uuid: string): Promise<T>
    load(type: string, uuid: string): Promise<IMoyskladEntity>
    load(type: string, query: Query): Promise<EntityCollection>
  }

  export function createClient(): Client

  export function createQuery(): Query

}