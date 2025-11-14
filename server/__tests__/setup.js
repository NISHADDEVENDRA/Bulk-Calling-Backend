/**
 * Jest Test Setup
 * Global setup for all tests
 */

process.env.NODE_ENV = 'test';
process.env.EXOTEL_API_KEY = 'test_api_key';
process.env.EXOTEL_API_TOKEN = 'test_api_token';
process.env.EXOTEL_SID = 'test_sid';
process.env.EXOTEL_VIRTUAL_NUMBER = '+911234567890';
process.env.EXOTEL_APP_ID = 'test_app_id';
process.env.MAX_CONCURRENT_OUTBOUND_CALLS = '10';
process.env.REDIS_HOST = 'localhost';
process.env.REDIS_PORT = '6379';

jest.mock('../utils/logger', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

jest.setTimeout(10000);


