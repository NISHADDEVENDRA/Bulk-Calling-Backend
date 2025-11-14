module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/server'],
  testMatch: ['**/__tests__/**/*.test.js'],
  moduleFileExtensions: ['js', 'json'],
  collectCoverageFrom: [
    'server/**/*.js',
    '!server/**/__tests__/**'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  setupFilesAfterEnv: ['<rootDir>/server/__tests__/setup.js'],
  testTimeout: 10000
};
