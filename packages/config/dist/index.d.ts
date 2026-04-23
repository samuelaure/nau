import { z, ZodObject, ZodRawShape } from 'zod';
export declare class ConfigError extends Error {
    constructor(issues: z.ZodIssue[]);
}
export declare function createConfig<T extends ZodRawShape>(schema: ZodObject<T>): z.infer<ZodObject<T>>;
export declare const baseApiSchema: z.ZodObject<{
    DATABASE_URL: z.ZodString;
    REDIS_URL: z.ZodString;
    NAU_API_URL: z.ZodString;
    AUTH_SECRET: z.ZodString;
    NODE_ENV: z.ZodDefault<z.ZodEnum<["development", "production", "test"]>>;
}, "strip", z.ZodTypeAny, {
    DATABASE_URL: string;
    REDIS_URL: string;
    NAU_API_URL: string;
    AUTH_SECRET: string;
    NODE_ENV: "development" | "production" | "test";
}, {
    DATABASE_URL: string;
    REDIS_URL: string;
    NAU_API_URL: string;
    AUTH_SECRET: string;
    NODE_ENV?: "development" | "production" | "test" | undefined;
}>;
export declare const baseNextSchema: z.ZodObject<{
    NEXT_PUBLIC_APP_URL: z.ZodString;
    NAU_API_URL: z.ZodString;
    AUTH_SECRET: z.ZodString;
    NODE_ENV: z.ZodDefault<z.ZodEnum<["development", "production", "test"]>>;
}, "strip", z.ZodTypeAny, {
    NAU_API_URL: string;
    AUTH_SECRET: string;
    NODE_ENV: "development" | "production" | "test";
    NEXT_PUBLIC_APP_URL: string;
}, {
    NAU_API_URL: string;
    AUTH_SECRET: string;
    NEXT_PUBLIC_APP_URL: string;
    NODE_ENV?: "development" | "production" | "test" | undefined;
}>;
export { z };
//# sourceMappingURL=index.d.ts.map