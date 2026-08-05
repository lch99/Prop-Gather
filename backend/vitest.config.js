import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    // better-sqlite3's native binding doesn't play well with vitest's default
    // worker_threads pool (it hangs); child-process forks work reliably.
    pool: 'forks',
    fileParallelism: false,
    setupFiles: ['./test/setup.js'],
    env: {
      NODE_ENV: 'test',
      DB_PATH: ':memory:',
      JWT_SECRET: 'test-secret',
      BCRYPT_ROUNDS: '4'
    }
  }
})
