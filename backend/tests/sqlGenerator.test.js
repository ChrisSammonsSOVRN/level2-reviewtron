const sqlGenerator = require('../utils/sqlGenerator');

describe('SQL Generator Module', () => {
    describe('generateAuditResultSQL', () => {
        it('should generate SQL for inserting audit results', () => {
            // Arrange
            const auditResult = {
                url: 'https://example.com',
                timestamp: '2023-01-01T12:00:00Z',
                status: 'passed',
                failureReason: null,
                siteId: 1
            };
            
            // Act
            const result = sqlGenerator.generateAuditResultSQL(auditResult);
            
            // Assert
            expect(result).toHaveProperty('text');
            expect(result).toHaveProperty('values');
            expect(result.text).toContain('INSERT INTO audit_results');
            expect(result.values).toHaveLength(5);
            expect(result.values).toContain('https://example.com');
            expect(result.values).toContain('passed');
        });
        
        it('should handle audit results with failure reason', () => {
            // Arrange
            const auditResult = {
                url: 'https://example.com',
                timestamp: '2023-01-01T12:00:00Z',
                status: 'failed',
                failureReason: 'Content issues',
                siteId: 1
            };
            
            // Act
            const result = sqlGenerator.generateAuditResultSQL(auditResult);
            
            // Assert
            expect(result.values).toContain('failed');
            expect(result.values).toContain('Content issues');
        });
    });
    
    describe('generateAuditCheckResultsSQL', () => {
        it('should generate SQL for inserting multiple check results', () => {
            // Arrange
            const auditId = 1;
            const checks = [
                {
                    name: 'Content Check',
                    status: 'passed',
                    reason: null,
                    details: { passed: true }
                },
                {
                    name: 'Image Check',
                    status: 'failed',
                    reason: 'Missing alt text',
                    details: { images: [{ src: 'image.jpg', alt: '' }] }
                }
            ];
            
            // Act
            const result = sqlGenerator.generateAuditCheckResultsSQL(auditId, checks);
            
            // Assert
            expect(result).toHaveProperty('text');
            expect(result).toHaveProperty('values');
            expect(result.text).toContain('INSERT INTO audit_check_results');
            expect(result.text).toContain('VALUES');
            expect(result.values.length).toBeGreaterThan(0);
        });
        
        it('should handle empty checks array', () => {
            // Arrange
            const auditId = 1;
            const checks = [];
            
            // Act
            const result = sqlGenerator.generateAuditCheckResultsSQL(auditId, checks);
            
            // Assert
            expect(result).toBeNull();
        });
        
        it('should stringify JSON details', () => {
            // Arrange
            const auditId = 1;
            const checks = [
                {
                    name: 'Complex Check',
                    status: 'passed',
                    reason: null,
                    details: { 
                        nested: { 
                            data: [1, 2, 3],
                            object: { key: 'value' }
                        }
                    }
                }
            ];
            
            // Act
            const result = sqlGenerator.generateAuditCheckResultsSQL(auditId, checks);
            
            // Assert
            expect(result).toHaveProperty('values');
            // Check that one of the values is a JSON string
            const jsonString = result.values.find(v => typeof v === 'string' && v.includes('{'));
            expect(jsonString).toBeDefined();
            // Verify it can be parsed back to an object
            const parsed = JSON.parse(jsonString);
            expect(parsed).toHaveProperty('nested');
            expect(parsed.nested).toHaveProperty('data');
            expect(parsed.nested.data).toEqual([1, 2, 3]);
        });
    });
    
    describe('generateSiteSQL', () => {
        it('should generate SQL for inserting or updating a site', () => {
            // Arrange
            const url = 'https://example.com';
            
            // Act
            const result = sqlGenerator.generateSiteSQL(url);
            
            // Assert
            expect(result).toHaveProperty('text');
            expect(result).toHaveProperty('values');
            expect(result.text).toContain('INSERT INTO sites');
            expect(result.text).toContain('ON CONFLICT');
            expect(result.values).toContain(url);
        });
    });
}); 