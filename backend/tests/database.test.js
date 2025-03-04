const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const { logMessage } = require('../utils/logger');

// Mock the dependencies
jest.mock('pg', () => {
    const mockClient = {
        query: jest.fn(),
        release: jest.fn()
    };
    
    const mockPool = {
        query: jest.fn(),
        connect: jest.fn().mockResolvedValue(mockClient),
        on: jest.fn()
    };
    
    return {
        Pool: jest.fn(() => mockPool),
        mockPool,
        mockClient
    };
});

jest.mock('fs', () => ({
    readFileSync: jest.fn(),
    promises: {
        writeFile: jest.fn()
    }
}));

jest.mock('../utils/logger', () => ({
    logMessage: jest.fn()
}));

// Import the database module after mocking dependencies
const db = require('../db/database');
const { mockPool, mockClient } = require('pg');

describe('Database Module', () => {
    beforeEach(() => {
        // Clear all mocks before each test
        jest.clearAllMocks();
    });
    
    describe('query', () => {
        it('should execute a query and return results', async () => {
            // Arrange
            const text = 'SELECT * FROM test';
            const params = [1, 2];
            const mockResult = { rows: [{ id: 1, name: 'Test' }] };
            mockPool.query.mockResolvedValue(mockResult);
            
            // Act
            const result = await db.query(text, params);
            
            // Assert
            expect(mockPool.query).toHaveBeenCalledWith(text, params);
            expect(result).toBe(mockResult);
        });
        
        it('should handle query errors', async () => {
            // Arrange
            const text = 'SELECT * FROM test';
            const error = new Error('Query error');
            mockPool.query.mockRejectedValue(error);
            
            // Act & Assert
            await expect(db.query(text)).rejects.toThrow('Query error');
        });
    });
    
    describe('transaction', () => {
        it('should execute a transaction with a callback function', async () => {
            // Arrange
            const callback = jest.fn().mockResolvedValue('result');
            mockClient.query.mockResolvedValue({});
            
            // Act
            const result = await db.transaction(callback);
            
            // Assert
            expect(mockPool.connect).toHaveBeenCalled();
            expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
            expect(callback).toHaveBeenCalledWith(mockClient);
            expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
            expect(result).toBe('result');
            expect(mockClient.release).toHaveBeenCalled();
        });
        
        it('should handle transaction errors', async () => {
            // Arrange
            const callback = jest.fn().mockRejectedValue(new Error('Transaction error'));
            mockClient.query.mockResolvedValue({});
            
            // Act & Assert
            await expect(db.transaction(callback)).rejects.toThrow('Transaction error');
            expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
            expect(mockClient.release).toHaveBeenCalled();
        });
    });
    
    describe('initDatabase', () => {
        it('should initialize the database with schema', async () => {
            // Arrange
            const mockSchema = 'CREATE TABLE test (id SERIAL PRIMARY KEY, name TEXT);';
            fs.readFileSync.mockReturnValue(mockSchema);
            mockPool.query.mockResolvedValue({ rows: [] });
            
            // Act
            await db.initDatabase();
            
            // Assert
            expect(fs.readFileSync).toHaveBeenCalledWith(expect.stringContaining('schema.sql'), 'utf8');
            expect(mockPool.query).toHaveBeenCalledWith(mockSchema);
        });
        
        it('should handle missing schema file', async () => {
            // Arrange
            const fileError = new Error('File not found');
            fileError.code = 'ENOENT';
            fs.readFileSync.mockImplementation(() => {
                throw fileError;
            });
            
            // Act & Assert
            await expect(db.initDatabase()).rejects.toThrow('Error reading schema file');
        });
        
        it('should handle database initialization errors', async () => {
            // Arrange
            const mockSchema = 'CREATE TABLE test (id SERIAL PRIMARY KEY, name TEXT);';
            fs.readFileSync.mockReturnValue(mockSchema);
            const dbError = new Error('Database error');
            mockPool.query.mockRejectedValue(dbError);
            
            // Act & Assert
            await expect(db.initDatabase()).rejects.toThrow('Error initializing database');
        });
    });
}); 