import { Logger } from 'pino';
export interface NauLoggerOptions {
    service: string;
    level?: string;
}
export type NauLogger = Logger;
export declare function createLogger(options: NauLoggerOptions): NauLogger;
//# sourceMappingURL=index.d.ts.map