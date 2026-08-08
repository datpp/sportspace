import { defineConfig } from 'orval';

export default defineConfig({
  sportspace: {
    input: {
      target: './openapi.json',
    },
    output: {
      mode: 'tags-split',
      target: 'packages/shared/src/generated/client.ts',
      schemas: 'packages/shared/src/generated/model',
      client: 'axios',
      mock: true,
    },
  },
});
