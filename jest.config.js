/**
 * Jest 配置 - 万物手札 v6.0.0
 */
export default {
  testEnvironment: 'jsdom',
  testMatch: ['**/tests/**/*.test.js'],
  moduleFileExtensions: ['js'],
  transform: {},
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  verbose: true,
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/plugins/**',
    '!src/components/**'
  ],
  coverageThreshold: {
    global: {
      branches: 60,
      functions: 70,
      lines: 70,
      statements: 70
    }
  }
};
