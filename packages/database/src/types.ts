export type Row = Record<string, unknown>;
export interface SqlSession {
 query<T extends Row = Row>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>;
 exec(sql: string): Promise<void>;
}
export interface StateDatabase extends SqlSession {
 transaction<T>(work: (tx: SqlSession) => Promise<T>): Promise<T>;
 close(): Promise<void>;
}
