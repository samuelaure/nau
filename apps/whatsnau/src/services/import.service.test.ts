import { ImportService } from './import.service.js';

describe('ImportService Unit Tests', () => {
    describe('cleanPhoneNumber', () => {
        it('should remove non-numeric characters except +', () => {
            expect(ImportService.cleanPhoneNumber('666-555-444')).toBe('+34666555444');
            expect(ImportService.cleanPhoneNumber('+1 (123) 456-7890')).toBe('+11234567890');
        });

        it('should add +34 prefix to 9-digit Spain numbers', () => {
            expect(ImportService.cleanPhoneNumber('600111222')).toBe('+34600111222');
            expect(ImportService.cleanPhoneNumber('912345678')).toBe('+34912345678');
            expect(ImportService.cleanPhoneNumber('711223344')).toBe('+34711223344');
        });

        it('should not add +34 if + prefix already exists', () => {
            expect(ImportService.cleanPhoneNumber('+447700900123')).toBe('+447700900123');
        });

        it('should handle empty or malformed input gracefully', () => {
            expect(ImportService.cleanPhoneNumber('')).toBe('');
            expect(ImportService.cleanPhoneNumber('abc')).toBe('');
        });
    });

    describe('cleanWebsite', () => {
        it('should add https:// protocol if missing', () => {
            expect(ImportService.cleanWebsite('google.com')).toBe('https://google.com');
            expect(ImportService.cleanWebsite('www.test.es')).toBe('https://www.test.es');
        });

        it('should not add https:// if protocol already present', () => {
            expect(ImportService.cleanWebsite('http://example.com')).toBe('http://example.com');
            expect(ImportService.cleanWebsite('https://example.com')).toBe('https://example.com');
        });

        it('should return null for empty input', () => {
            expect(ImportService.cleanWebsite('')).toBeNull();
            expect(ImportService.cleanWebsite(null)).toBeNull();
        });
    });
});
