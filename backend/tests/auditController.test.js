const auditController = require('../controllers/auditController');
const puppeteer = require('puppeteer');
const db = require('../db/database');
const sqlGenerator = require('../controllers/sqlGenerator');
const imageAnalyzer = require('../controllers/imageAnalyzer');
const { logMessage } = require('../utils/logger');

// Mock dependencies
jest.mock('puppeteer');
jest.mock('../db/database');
jest.mock('../controllers/sqlGenerator');
jest.mock('../controllers/imageAnalyzer', () => ({
    analyzeImage: jest.fn(),
    analyzeUrl: jest.fn()
}));
jest.mock('../utils/logger', () => ({
    logMessage: jest.fn()
}));

describe('Audit Controller', () => {
    let mockBrowser;
    let mockPage;
    
    beforeEach(() => {
        // Reset all mocks
        jest.clearAllMocks();
        
        // Mock puppeteer
        mockPage = {
            goto: jest.fn().mockResolvedValue(),
            content: jest.fn().mockResolvedValue('<html><head><title>Test Page</title></head><body><h1>Test</h1></body></html>'),
            evaluate: jest.fn().mockImplementation((fn) => {
                // Simple mock implementation for evaluate
                if (fn.toString().includes('document.title')) {
                    return 'Test Page';
                }
                if (fn.toString().includes('meta')) {
                    return { description: 'Test description' };
                }
                if (fn.toString().includes('h1')) {
                    return ['Test'];
                }
                if (fn.toString().includes('h2')) {
                    return ['Subheading'];
                }
                if (fn.toString().includes('img')) {
                    return [{ src: 'test.jpg', alt: 'Test image' }];
                }
                if (fn.toString().includes('a')) {
                    return [{ href: 'https://example.com/page1', text: 'Link 1' }];
                }
                return null;
            }),
            close: jest.fn().mockResolvedValue(),
            screenshot: jest.fn().mockResolvedValue(Buffer.from('test-screenshot')),
            setViewport: jest.fn().mockResolvedValue(),
            setUserAgent: jest.fn().mockResolvedValue(),
            setExtraHTTPHeaders: jest.fn().mockResolvedValue(),
        };
        
        mockBrowser = {
            newPage: jest.fn().mockResolvedValue(mockPage),
            close: jest.fn().mockResolvedValue(),
        };
        
        puppeteer.launch.mockResolvedValue(mockBrowser);
        
        // Mock database
        db.transaction.mockImplementation((callback) => {
            return callback({ 
                query: jest.fn().mockImplementation((text, params) => {
                    if (text.includes('RETURNING id')) {
                        return { rows: [{ id: 1 }] };
                    }
                    return { rows: [] };
                })
            });
        });
        
        // Mock sqlGenerator - using the correct methods from the controllers/sqlGenerator
        sqlGenerator.generateSQLForAudit.mockReturnValue({
            success: true,
            url: 'https://example.com',
            status: 'passed',
            reason: '',
            rejectionCode: '',
            sql: {
                audit: 'INSERT INTO audit_results...',
                update: 'UPDATE sites...',
                details: 'INSERT INTO audit_check_results...',
                transaction: 'BEGIN; ... COMMIT;'
            }
        });
        
        // Mock imageAnalyzer
        imageAnalyzer.analyzeImage.mockResolvedValue({
            size: 10240,
            format: 'jpeg',
            width: 800,
            height: 600,
            optimized: true
        });
        
        imageAnalyzer.analyzeUrl.mockResolvedValue({
            status: 'pass',
            details: {
                images: [
                    { url: 'test.jpg', size: 10240, format: 'jpeg', optimized: true }
                ]
            }
        });
    });
    
    describe('auditUrl', () => {
        it('should successfully audit a URL', async () => {
            // Arrange
            const url = 'https://example.com';
            const req = { params: { url } };
            const res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn()
            };
            
            // Act
            await auditController.auditUrl(req, res);
            
            // Assert
            expect(puppeteer.launch).toHaveBeenCalled();
            expect(mockBrowser.newPage).toHaveBeenCalled();
            expect(mockPage.goto).toHaveBeenCalledWith(url, expect.any(Object));
            expect(mockPage.content).toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                success: true,
                url,
                title: 'Test Page',
                checks: expect.any(Array)
            }));
        });
        
        it('should handle invalid URLs', async () => {
            // Arrange
            const url = 'invalid-url';
            const req = { params: { url } };
            const res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn()
            };
            
            // Act
            await auditController.auditUrl(req, res);
            
            // Assert
            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                success: false,
                error: expect.stringContaining('Invalid URL')
            }));
        });
        
        it('should handle navigation errors', async () => {
            // Arrange
            const url = 'https://example.com';
            const req = { params: { url } };
            const res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn()
            };
            
            // Mock navigation error
            mockPage.goto.mockRejectedValue(new Error('Navigation failed'));
            
            // Act
            await auditController.auditUrl(req, res);
            
            // Assert
            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                success: false,
                error: expect.stringContaining('Navigation failed')
            }));
        });
        
        it('should handle database errors', async () => {
            // Arrange
            const url = 'https://example.com';
            const req = { params: { url } };
            const res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn()
            };
            
            // Mock database error
            db.transaction.mockRejectedValue(new Error('Database error'));
            
            // Act
            await auditController.auditUrl(req, res);
            
            // Assert
            // The function should still return a 200 status with the audit results
            // even if the database operation fails
            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                success: true,
                url,
                title: 'Test Page'
            }));
        });
        
        it('should check content for SEO issues', async () => {
            // Arrange
            const url = 'https://example.com';
            const req = { params: { url } };
            const res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn()
            };
            
            // Act
            await auditController.auditUrl(req, res);
            
            // Assert
            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                checks: expect.arrayContaining([
                    expect.objectContaining({ name: 'title' }),
                    expect.objectContaining({ name: 'meta_description' }),
                    expect.objectContaining({ name: 'headings' }),
                    expect.objectContaining({ name: 'images' }),
                    expect.objectContaining({ name: 'links' })
                ])
            }));
        });
    });
    
    describe('storeAuditResult', () => {
        it('should store audit result in database', async () => {
            // Arrange
            const auditResult = {
                url: 'https://example.com',
                timestamp: new Date().toISOString(),
                title: 'Test Page',
                description: 'Test description',
                screenshot: 'base64-encoded-screenshot',
                checks: [
                    {
                        name: 'title',
                        status: 'pass',
                        details: { title: 'Test Page' }
                    }
                ]
            };
            
            // Act
            const result = await auditController.storeAuditResult(auditResult);
            
            // Assert
            expect(sqlGenerator.generateSQLForAudit).toHaveBeenCalledWith(auditResult);
            expect(db.transaction).toHaveBeenCalled();
            expect(result).toEqual(expect.objectContaining({
                success: true,
                auditId: expect.any(Number)
            }));
        });
        
        it('should handle SQL generation errors', async () => {
            // Arrange
            const auditResult = {
                url: 'https://example.com',
                timestamp: new Date().toISOString(),
                title: 'Test Page'
            };
            
            // Mock SQL generation error
            sqlGenerator.generateSQLForAudit.mockReturnValue({
                success: false,
                error: 'SQL generation error'
            });
            
            // Act & Assert
            await expect(auditController.storeAuditResult(auditResult))
                .rejects.toThrow('Database error: Failed to generate SQL: SQL generation error');
        });
        
        it('should handle database transaction errors', async () => {
            // Arrange
            const auditResult = {
                url: 'https://example.com',
                timestamp: new Date().toISOString(),
                title: 'Test Page',
                checks: []
            };
            
            // Mock transaction error
            db.transaction.mockRejectedValue(new Error('Transaction failed'));
            
            // Act & Assert
            await expect(auditController.storeAuditResult(auditResult))
                .rejects.toThrow('Database error: Transaction failed');
        });
    });
}); 