import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    execArgv: ['--no-warnings=ExperimentalWarning'],
  },
});
