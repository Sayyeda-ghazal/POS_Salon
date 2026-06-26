declare module 'better-sqlite3' {
  export interface Statement {
    get(...params: unknown[]): unknown;
    all(...params: unknown[]): unknown[];
    run(...params: unknown[]): { changes: number; lastInsertRowid: number };
  }

  export interface Database {
    exec(sql: string): void;
    pragma(pragma: string): void;
    prepare(sql: string): Statement;
    transaction<T extends (...args: any[]) => any>(fn: T): T;
    close(): void;
  }

  export default class BetterSqlite3 {
    constructor(filename: string, options?: Record<string, unknown>);
    exec(sql: string): void;
    pragma(pragma: string): void;
    prepare(sql: string): Statement;
    transaction<T extends (...args: any[]) => any>(fn: T): T;
    close(): void;
  }
}
