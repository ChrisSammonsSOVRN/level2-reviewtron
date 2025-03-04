# Website Auditor API Documentation

## Overview

The Website Auditor API provides endpoints for auditing websites and retrieving audit history. This document outlines the available endpoints, their parameters, and example responses.

## Base URL

```
http://localhost:5000
```

## Authentication

Currently, the API does not require authentication.

## Endpoints

### Audit Endpoints

#### Audit a URL

```
POST /audit/url
```

Analyzes a URL for compliance with various checks including banned words, redirects, content recency, hate speech, plagiarism, image analysis, and ad presence.

**Request Body:**

```json
{
  "url": "https://example.com"
}
```

**Response:**

```json
{
  "url": "https://example.com",
  "timestamp": "2023-03-03T12:34:56.789Z",
  "status": "pass",
  "checks": {
    "bannedWords": null,
    "redirect": null,
    "contentRecency": {
      "status": "pass",
      "reason": "Content meets recency and historical requirements",
      "details": "Content ranges from 5 to 120 days old"
    },
    "hateSpeech": {
      "status": "pass",
      "reason": "No hate speech detected"
    },
    "plagiarism": {
      "status": "pass",
      "reason": "No plagiarism detected"
    },
    "images": {
      "status": "pass",
      "reason": "No inappropriate images detected"
    },
    "ads": {
      "status": "pass",
      "reason": "Sufficient premium ad partners detected (≥2)"
    }
  },
  "databaseStorage": {
    "success": true,
    "status": "passed",
    "rejectionCode": ""
  }
}
```

### History Endpoints

#### Get Latest Audit Results

```
GET /history/latest
```

Returns the latest audit results for all sites, limited to 100 entries.

**Response:**

```json
{
  "success": true,
  "count": 10,
  "data": [
    {
      "id": 1,
      "url": "https://example.com",
      "timestamp": "2023-03-03T12:34:56.789Z",
      "status": "passed",
      "failure_reason": null,
      "rejection_code": null,
      "created_at": "2023-03-03T12:34:56.789Z"
    },
    // More results...
  ]
}
```

#### Get Audit History for a Specific Site

```
GET /history/site/:url
```

Returns the audit history for a specific site.

**Parameters:**

- `url` (path parameter): The URL of the site to retrieve history for (URL-encoded)

**Response:**

```json
{
  "success": true,
  "count": 5,
  "data": [
    {
      "id": 1,
      "url": "https://example.com",
      "timestamp": "2023-03-03T12:34:56.789Z",
      "status": "passed",
      "failure_reason": null,
      "rejection_code": null,
      "created_at": "2023-03-03T12:34:56.789Z"
    },
    // More results...
  ]
}
```

#### Get Detailed Check Results for a Specific Audit

```
GET /history/checks/:url/:timestamp
```

Returns detailed check results for a specific audit.

**Parameters:**

- `url` (path parameter): The URL of the site (URL-encoded)
- `timestamp` (path parameter): The timestamp of the audit

**Response:**

```json
{
  "success": true,
  "count": 5,
  "data": [
    {
      "id": 1,
      "url": "https://example.com",
      "timestamp": "2023-03-03T12:34:56.789Z",
      "check_name": "contentRecency",
      "status": "passed",
      "reason": "Content meets recency and historical requirements",
      "details": {"mostRecentDays": 5, "oldestDays": 120},
      "created_at": "2023-03-03T12:34:56.789Z"
    },
    // More check results...
  ]
}
```

#### Get Audit Statistics

```
GET /history/stats
```

Returns statistics about audit results.

**Response:**

```json
{
  "success": true,
  "data": {
    "overall": {
      "total_audits": 1000,
      "unique_sites": 500,
      "passed_count": 800,
      "failed_count": 200,
      "pass_rate": 80.00
    },
    "failureReasons": [
      {
        "failure_reason": "Content too old",
        "count": 50,
        "percentage": 25.00
      },
      // More failure reasons...
    ],
    "trends": [
      {
        "date": "2023-03-01T00:00:00.000Z",
        "total": 100,
        "passed": 80,
        "failed": 20
      },
      // More trend data...
    ]
  }
}
```

#### Search Audit History

```
GET /history/search
```

Searches audit history based on various criteria.

**Query Parameters:**

- `query` (optional): Search term for URL
- `status` (optional): Filter by status ('passed' or 'failed')
- `startDate` (optional): Filter by start date (ISO format)
- `endDate` (optional): Filter by end date (ISO format)
- `limit` (optional): Number of results per page (default: 50)
- `offset` (optional): Offset for pagination (default: 0)

**Response:**

```json
{
  "success": true,
  "count": 10,
  "total": 100,
  "data": [
    {
      "id": 1,
      "url": "https://example.com",
      "timestamp": "2023-03-03T12:34:56.789Z",
      "status": "passed",
      "failure_reason": null,
      "rejection_code": null,
      "created_at": "2023-03-03T12:34:56.789Z"
    },
    // More results...
  ],
  "pagination": {
    "limit": 10,
    "offset": 0,
    "hasMore": true
  }
}
```

#### Export Audit History to CSV

```
GET /history/export
```

Exports audit history to a CSV file.

**Query Parameters:**

- `status` (optional): Filter by status ('passed' or 'failed')
- `startDate` (optional): Filter by start date (ISO format)
- `endDate` (optional): Filter by end date (ISO format)

**Response:**

A CSV file download with the following columns:
- URL
- Timestamp
- Status
- Failure Reason
- Rejection Code

## Error Responses

All endpoints return a standard error format:

```json
{
  "success": false,
  "error": "Error message"
}
```

HTTP status codes:
- 400: Bad Request
- 404: Not Found
- 500: Server Error 