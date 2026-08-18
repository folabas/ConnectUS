/**
 * Test environment.
 *
 * Configured before any module reads `process.env`, because `config/env.ts`
 * validates at import time and calls `process.exit(1)` on failure — a test run
 * would otherwise die with no output rather than fail an assertion.
 *
 * Tests run against a real MongoDB rather than an in-memory replacement. The
 * bugs these tests exist to catch were about `populate` changing a field's
 * runtime type and about `$addToSet` versus `push` under concurrency, and a
 * substitute driver is exactly the wrong place to verify those.
 */

process.env.NODE_ENV = 'test';
process.env.PORT = process.env.PORT || '5099';
process.env.MONGODB_URI =
    process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27017/connectus_test';
process.env.JWT_SECRET =
    'test-only-secret-not-used-anywhere-real-0123456789abcdef';
process.env.JWT_EXPIRE = '1h';
process.env.ALLOWED_ORIGINS = 'http://localhost:3000';
process.env.FRONTEND_URL = 'http://localhost:3000';
