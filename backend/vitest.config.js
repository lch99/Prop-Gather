import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    pool: 'forks',
    // Every test file shares one MySQL database (there is no `:memory:`
    // equivalent), and freshApp() empties it before each test — so two files
    // running at once would wipe each other's rows mid-test.
    fileParallelism: false,
    setupFiles: ['./test/setup.js'],
    env: {
      NODE_ENV: 'test',
      // A database of its own, never the dev one: the suite deletes every row
      // in it before each test.
      MYSQL_HOST: process.env.MYSQL_HOST || '127.0.0.1',
      MYSQL_PORT: process.env.MYSQL_PORT || '3306',
      MYSQL_USER: process.env.MYSQL_USER || 'root',
      MYSQL_PASSWORD: process.env.MYSQL_PASSWORD || 'root',
      MYSQL_DATABASE: process.env.MYSQL_TEST_DATABASE || 'propgather_test',
      JWT_SECRET: 'test-secret',
      // Test speed only — bcrypt at the real cost factor of 10 dominates the
      // run (it was ~2.9s of a 4.2s seed measured at rounds=10). Never set this
      // outside tests.
      BCRYPT_ROUNDS: '4'
    }
  }
})
