import { describe, it, expect } from 'vitest';
import { sanitizeForTelegram, formatContextForTelegram } from './sanitization.util.js';

describe('Sanitization Utility', () => {
    describe('sanitizeForTelegram', () => {
        it('should redact phone numbers', () => {
            const input = { phoneNumber: '+34600111222', name: 'John' };
            const result = sanitizeForTelegram(input);

            expect(result.phoneNumber).toBe('+34***222');
            expect(result.name).toBe('John');
        });

        it('should redact WhatsApp IDs', () => {
            const input = { whatsappId: 'wamid.ABC123XYZ456', id: 'wamid.TEST' };
            const result = sanitizeForTelegram(input);

            expect(result.whatsappId).toBe('wa***');
            expect(result.id).toBe('wa***');
        });

        it('should redact message content', () => {
            const input = {
                content: 'Sensitive user message',
                message: 'Another sensitive message',
                text: 'Text content',
                body: 'Body content'
            };
            const result = sanitizeForTelegram(input);

            expect(result.content).toBe('[REDACTED]');
            expect(result.message).toBe('[REDACTED]');
            expect(result.text).toBe('[REDACTED]');
            expect(result.body).toBe('[REDACTED]');
        });

        it('should redact sensitive keys (token, password, secret)', () => {
            const input = {
                apiToken: 'secret-token-123',
                password: 'myPassword123',
                secretKey: 'sk-123456',
                authToken: 'bearer-xyz',
                credential: 'cred-abc'
            };
            const result = sanitizeForTelegram(input);

            expect(result.apiToken).toBe('[REDACTED]');
            expect(result.password).toBe('[REDACTED]');
            expect(result.secretKey).toBe('[REDACTED]');
            expect(result.authToken).toBe('[REDACTED]');
            expect(result.credential).toBe('[REDACTED]');
        });

        it('should handle nested objects', () => {
            const input = {
                user: {
                    phoneNumber: '+34600111222',
                    password: 'secret123'
                },
                metadata: {
                    content: 'Sensitive message',
                    timestamp: '2024-01-01'
                }
            };
            const result = sanitizeForTelegram(input);

            expect(result.user.phoneNumber).toBe('+34***222');
            expect(result.user.password).toBe('[REDACTED]');
            expect(result.metadata.content).toBe('[REDACTED]');
            expect(result.metadata.timestamp).toBe('2024-01-01');
        });

        it('should handle arrays', () => {
            const input = {
                users: [
                    { phoneNumber: '+34600111222', name: 'John' },
                    { phoneNumber: '+34600333444', name: 'Jane' }
                ]
            };
            const result = sanitizeForTelegram(input);

            expect(result.users[0].phoneNumber).toBe('+34***222');
            expect(result.users[1].phoneNumber).toBe('+34***444');
            expect(result.users[0].name).toBe('John');
        });

        it('should handle null and undefined', () => {
            const input = {
                phoneNumber: null,
                content: undefined,
                name: 'John'
            };
            const result = sanitizeForTelegram(input);

            expect(result.phoneNumber).toBe('[REDACTED]');
            expect(result.content).toBe('[REDACTED]');
            expect(result.name).toBe('John');
        });

        it('should preserve safe fields', () => {
            const input = {
                id: 'lead-123',
                tenantId: 'tenant-456',
                category: 'SYSTEM_ERROR',
                severity: 'CRITICAL',
                timestamp: '2024-01-01T00:00:00Z'
            };
            const result = sanitizeForTelegram(input);

            expect(result.id).toBe('lead-123');
            expect(result.tenantId).toBe('tenant-456');
            expect(result.category).toBe('SYSTEM_ERROR');
            expect(result.severity).toBe('CRITICAL');
            expect(result.timestamp).toBe('2024-01-01T00:00:00Z');
        });

        it('should handle complex real-world context', () => {
            const input = {
                category: 'WORKER_OUTBOUND',
                severity: 'CRITICAL',
                jobId: 'job-123',
                correlationId: 'corr-456',
                error: {
                    message: 'Connection timeout',
                    code: 'ETIMEDOUT'
                },
                metadata: {
                    phoneNumber: '+34600111222',
                    whatsappId: 'wamid.ABC123',
                    content: 'User message here',
                    apiToken: 'secret-token'
                }
            };
            const result = sanitizeForTelegram(input);

            expect(result.category).toBe('WORKER_OUTBOUND');
            expect(result.severity).toBe('CRITICAL');
            expect(result.jobId).toBe('job-123');
            expect(result.metadata.phoneNumber).toBe('+34***222');
            expect(result.metadata.whatsappId).toBe('wa***');
            expect(result.metadata.content).toBe('[REDACTED]');
            expect(result.metadata.apiToken).toBe('[REDACTED]');
        });
    });

    describe('formatContextForTelegram', () => {
        it('should format simple context with bold keys', () => {
            const context = {
                category: 'TEST',
                severity: 'INFO',
                tenantId: 'tenant-1'
            };
            const result = formatContextForTelegram(context);

            expect(result).toContain('<b>category:</b> TEST');
            expect(result).toContain('<b>severity:</b> INFO');
            expect(result).toContain('<b>tenantId:</b> tenant-1');
            expect(result).toContain('\\n');
        });

        it('should redact sensitive values in formatted string', () => {
            const context = {
                phoneNumber: '+34600111222',
                apiToken: 'secret-123'
            };
            const result = formatContextForTelegram(context);

            expect(result).toContain('<b>phoneNumber:</b> +34***222');
            expect(result).toContain('<b>apiToken:</b> [REDACTED]');
        });

        it('should JSON stringify nested objects in formatted string', () => {
            const context = {
                metadata: {
                    info: 'value'
                }
            };
            const result = formatContextForTelegram(context);

            expect(result).toContain('<b>metadata:</b> {');
            expect(result).toContain('"info": "value"');
        });

        it('should handle primitives and nulls in sanitizeForTelegram', () => {
            expect(sanitizeForTelegram('string')).toBe('string');
            expect(sanitizeForTelegram(123)).toBe(123);
            expect(sanitizeForTelegram(true)).toBe(true);
            expect(sanitizeForTelegram(null)).toBe(null);
            expect(sanitizeForTelegram(undefined)).toBe(undefined);

            // Edge cases for specific redaction functions
            const shortPhone = { phoneNumber: '12' };
            expect(sanitizeForTelegram(shortPhone).phoneNumber).toBe('***');

            const emptyId = { whatsappId: '' };
            expect(sanitizeForTelegram(emptyId).whatsappId).toBe('[REDACTED]');
        });



        it('should skip null/undefined and error object', () => {
            const context = {
                id: '123',
                error: new Error('Internal'),
                optional: null
            };
            const result = formatContextForTelegram(context);

            expect(result).toContain('<b>id:</b> 123');
            expect(result).not.toContain('error');
            expect(result).not.toContain('optional');
        });
    });
});

