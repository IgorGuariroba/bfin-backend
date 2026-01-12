import { defineConfig } from 'orval';

export default defineConfig({
  bfin: {
    input: './openapi/openapi.json',
    output: {
      target: './sdk/client/api.ts',
      client: 'axios',
      mode: 'tags-split',
      mock: false,
      clean: false,
      prettier: true,
      override: {
        mutator: {
          path: './sdk/client/custom-instance.ts',
          name: 'customInstance',
        },
      },
    },
  },
  'bfin-react-query': {
    input: './openapi/openapi.json',
    output: {
      target: './sdk/react-query/hooks.ts',
      client: 'react-query',
      mode: 'tags-split',
      mock: false,
      clean: false,
      prettier: true,
      override: {
        mutator: {
          path: './sdk/client/custom-instance.ts',
          name: 'customInstance',
        },
        query: {
          useQuery: true,
          useMutation: true,
          signal: true,
        },
      },
    },
  },
  'bfin-swr': {
    input: './openapi/openapi.json',
    output: {
      target: './sdk/swr/hooks.ts',
      client: 'swr',
      mode: 'tags-split',
      mock: false,
      clean: false,
      prettier: true,
      override: {
        mutator: {
          path: './sdk/client/custom-instance.ts',
          name: 'customInstance',
        },
      },
    },
  },
});
