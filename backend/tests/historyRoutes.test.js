const request = require('supertest');
const express = require('express');
const historyRoutes = require('../routes/historyRoutes');
const db = require('../db/database');

// Mock the database module
jest.mock('../db/database');

// Create an Express application for testing
const app = express();
app.use(express.json());
app.use('/history', historyRoutes);

describe('History Routes API', () => {
    beforeEach(() => {
        // Clear all mocks before each test
        jest.clearAllMocks();
    });

    afterAll(() => {
        // Close any open connections
        jest.restoreAllMocks();
    });

    describe('GET /history/latest', () => {
        it('should return the latest audit results', async () => {
            // Mock data
            const mockResults = [
                {
                    url: 'https://example.com',
                    timestamp: '2023-01-01T12:00:00Z',
                    status: 'passed',
                    failureReason: null
                },
                {
                    url: 'https://test.com',
                    timestamp: '2023-01-01T11:00:00Z',
                    status: 'failed',
                    failureReason: 'Content issues'
                }
            ];

            // Mock the database query response
            db.query.mockResolvedValue({ rows: mockResults });

            // Make request to the endpoint
            const response = await request(app).get('/history/latest');

            // Assertions
            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('success', true);
            expect(response.body).toHaveProperty('data');
            expect(response.body.data).toEqual(mockResults);
            expect(db.query).toHaveBeenCalledTimes(1);
        });

        it('should handle database errors', async () => {
            // Mock database error
            db.query.mockRejectedValue(new Error('Database error'));

            // Make request to the endpoint
            const response = await request(app).get('/history/latest');

            // Assertions
            expect(response.status).toBe(500);
            expect(response.body).toHaveProperty('error');
            expect(db.query).toHaveBeenCalledTimes(1);
        });
    });

    describe('GET /history/site/:url', () => {
        it('should return audit history for a specific site', async () => {
            // Mock data
            const mockResults = [
                {
                    url: 'https://example.com',
                    timestamp: '2023-01-01T12:00:00Z',
                    status: 'passed',
                    failureReason: null
                },
                {
                    url: 'https://example.com',
                    timestamp: '2023-01-01T10:00:00Z',
                    status: 'failed',
                    failureReason: 'Content issues'
                }
            ];

            // Mock the database query response
            db.query.mockResolvedValue({ rows: mockResults });

            // Make request to the endpoint
            const response = await request(app).get('/history/site/https%3A%2F%2Fexample.com');

            // Assertions
            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('success', true);
            expect(response.body).toHaveProperty('data');
            expect(response.body.data).toEqual(mockResults);
            expect(db.query).toHaveBeenCalledTimes(1);
            expect(db.query).toHaveBeenCalledWith(
                expect.stringContaining('SELECT'),
                expect.arrayContaining(['https://example.com'])
            );
        });

        it('should handle empty results', async () => {
            // Mock empty results
            db.query.mockResolvedValue({ rows: [] });

            // Make request to the endpoint
            const response = await request(app).get('/history/site/https%3A%2F%2Fnonexistent.com');

            // Assertions
            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('success', true);
            expect(response.body).toHaveProperty('data');
            expect(response.body.data).toEqual([]);
            expect(db.query).toHaveBeenCalledTimes(1);
        });
    });

    describe('GET /history/checks/:url/:timestamp', () => {
        it('should return detailed check results for a specific audit', async () => {
            // Mock data for audit
            const mockAudit = {
                url: 'https://example.com',
                timestamp: '2023-01-01T12:00:00Z',
                status: 'passed',
                failureReason: null
            };

            // Mock data for checks
            const mockChecks = [
                {
                    name: 'Content Check',
                    status: 'passed',
                    reason: null,
                    details: { passed: true }
                },
                {
                    name: 'Image Check',
                    status: 'passed',
                    reason: null,
                    details: { passed: true }
                }
            ];

            // Mock the database query responses
            db.query.mockImplementation((query) => {
                if (query.includes('audit_results')) {
                    return Promise.resolve({ rows: [mockAudit] });
                } else if (query.includes('audit_check_results')) {
                    return Promise.resolve({ rows: mockChecks });
                }
                return Promise.resolve({ rows: [] });
            });

            // Make request to the endpoint
            const response = await request(app).get('/history/checks/https%3A%2F%2Fexample.com/2023-01-01T12:00:00Z');

            // Assertions
            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('success', true);
            expect(response.body).toHaveProperty('data');
            expect(response.body.data).toEqual(mockChecks);
            expect(db.query).toHaveBeenCalledTimes(1);
        });

        it('should return 404 if audit not found', async () => {
            // Mock empty results
            db.query.mockResolvedValue({ rows: [] });

            // Make request to the endpoint
            const response = await request(app).get('/history/checks/https%3A%2F%2Fnonexistent.com/2023-01-01T12:00:00Z');

            // Assertions
            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('success', true);
            expect(response.body).toHaveProperty('data');
            expect(response.body.data).toEqual([]);
            expect(db.query).toHaveBeenCalledTimes(1);
        });
    });

    describe('GET /history/stats', () => {
        it('should return audit statistics', async () => {
            // Mock data
            const mockStats = {
                overall: { count: 100 },
                trends: [{ count: 100 }],
                failureReasons: [{ count: 100 }]
            };

            // Mock multiple database queries
            db.query.mockImplementation((query) => {
                if (query.includes('COUNT(*)') && query.includes('audit_results')) {
                    return Promise.resolve({ rows: [{ count: 100 }] });
                } else if (query.includes('COUNT(DISTINCT url)')) {
                    return Promise.resolve({ rows: [{ count: 50 }] });
                } else if (query.includes('status = \'passed\'')) {
                    return Promise.resolve({ rows: [{ count: 75 }] });
                } else if (query.includes('status = \'failed\'')) {
                    return Promise.resolve({ rows: [{ count: 25 }] });
                } else if (query.includes('DATE(timestamp)')) {
                    return Promise.resolve({ 
                        rows: [
                            { date: '2023-01-01', status: 'passed', count: 10 },
                            { date: '2023-01-01', status: 'failed', count: 5 },
                            { date: '2023-01-02', status: 'passed', count: 15 },
                            { date: '2023-01-02', status: 'failed', count: 3 }
                        ] 
                    });
                } else if (query.includes('failure_reason')) {
                    return Promise.resolve({ 
                        rows: [
                            { reason: 'Content issues', count: 10 },
                            { reason: 'Image issues', count: 8 }
                        ]
                    });
                } else if (query.includes('DATE(NOW())')) {
                    return Promise.resolve({ rows: [{ count: 5 }] });
                }
                return Promise.resolve({ rows: [] });
            });

            // Make request to the endpoint
            const response = await request(app).get('/history/stats');

            // Assertions
            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('success', true);
            expect(response.body).toHaveProperty('data');
            expect(response.body.data).toHaveProperty('overall');
            expect(response.body.data).toHaveProperty('trends');
            expect(response.body.data).toHaveProperty('failureReasons');
        });

        it('should handle database errors', async () => {
            // Mock database error
            db.query.mockRejectedValue(new Error('Database error'));

            // Make request to the endpoint
            const response = await request(app).get('/history/stats');

            // Assertions
            expect(response.status).toBe(500);
            expect(response.body).toHaveProperty('error');
        });
    });

    describe('GET /history/search', () => {
        it('should search audit history with filters', async () => {
            // Mock data
            const mockResults = [
                {
                    url: 'https://example.com',
                    timestamp: '2023-01-01T12:00:00Z',
                    status: 'passed',
                    failureReason: null
                },
                {
                    url: 'https://test.com',
                    timestamp: '2023-01-01T11:00:00Z',
                    status: 'failed',
                    failureReason: 'Content issues'
                }
            ];

            // Mock the database query responses
            db.query.mockImplementation((query) => {
                if (query.includes('COUNT(*)')) {
                    return Promise.resolve({ rows: [{ count: 2 }] });
                } else {
                    return Promise.resolve({ rows: mockResults });
                }
            });

            // Make request to the endpoint with query parameters
            const response = await request(app)
                .get('/history/search')
                .query({
                    query: 'example',
                    status: 'passed',
                    startDate: '2023-01-01',
                    endDate: '2023-01-02',
                    page: 1,
                    limit: 10
                });

            // Assertions
            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('success', true);
            expect(response.body).toHaveProperty('data');
            expect(response.body).toHaveProperty('count');
            expect(response.body).toHaveProperty('pagination');
            expect(response.body.data).toEqual(mockResults);
            expect(db.query).toHaveBeenCalledTimes(2);
        });

        it('should handle empty search results', async () => {
            // Mock empty results
            db.query.mockImplementation((query) => {
                if (query.includes('COUNT(*)')) {
                    return Promise.resolve({ rows: [{ count: 0 }] });
                } else {
                    return Promise.resolve({ rows: [] });
                }
            });

            // Make request to the endpoint
            const response = await request(app).get('/history/search');

            // Assertions
            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('success', true);
            expect(response.body).toHaveProperty('data');
            expect(response.body).toHaveProperty('count', 0);
            expect(response.body.data).toEqual([]);
        });
    });
}); 