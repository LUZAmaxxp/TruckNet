/**
 * __tests__/setup.ts
 *
 * Global test setup — runs before every test file.
 * Sets required environment variables so /lib/env.ts parses without throwing.
 */

// Must be set before any @/ imports that pull in /lib/env.ts
process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/testdb";
process.env.NEXTAUTH_SECRET = "test-super-secret-12345";
process.env.NEXTAUTH_URL = "http://localhost:3000";
process.env.SOCKET_PORT = "3001";
process.env.NODE_ENV = "test";
