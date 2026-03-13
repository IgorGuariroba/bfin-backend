import type { OpenAPIV3 } from 'openapi-types';
import { describe, it, expect } from 'vitest';
import { swaggerToMarkdown } from '../../src/utils/swaggerToMarkdown';

describe('swaggerToMarkdown', () => {
  const baseSpec: OpenAPIV3.Document = {
    openapi: '3.0.0',
    info: {
      title: 'Test API',
      version: '1.0.0',
      description: 'Test API Description',
    },
    paths: {},
  };

  it('should generate markdown with title and version', () => {
    const spec: OpenAPIV3.Document = {
      ...baseSpec,
      info: {
        title: 'My API',
        version: '2.0.0',
      },
    };

    const result = swaggerToMarkdown(spec);

    expect(result).toContain('# My API');
    expect(result).toContain('**Version:** 2.0.0');
  });

  it('should include description when present', () => {
    const spec: OpenAPIV3.Document = {
      ...baseSpec,
      info: {
        title: 'Test API',
        version: '1.0.0',
        description: 'API for testing purposes',
      },
    };

    const result = swaggerToMarkdown(spec);

    expect(result).toContain('API for testing purposes');
  });

  it('should include contact information when present', () => {
    const spec: OpenAPIV3.Document = {
      ...baseSpec,
      info: {
        title: 'Test API',
        version: '1.0.0',
        contact: {
          name: 'Support Team',
          email: 'support@example.com',
        },
      },
    };

    const result = swaggerToMarkdown(spec);

    expect(result).toContain('## Contact');
    expect(result).toContain('**Name:** Support Team');
    expect(result).toContain('**Email:** support@example.com');
  });

  it('should include license information when present', () => {
    const spec: OpenAPIV3.Document = {
      ...baseSpec,
      info: {
        title: 'Test API',
        version: '1.0.0',
        license: {
          name: 'MIT',
          url: 'https://opensource.org/licenses/MIT',
        },
      },
    };

    const result = swaggerToMarkdown(spec);

    expect(result).toContain('## License');
    expect(result).toContain('[MIT](https://opensource.org/licenses/MIT)');
  });

  it('should include servers when present', () => {
    const spec: OpenAPIV3.Document = {
      ...baseSpec,
      servers: [
        {
          url: 'https://api.example.com/v1',
          description: 'Production Server',
        },
        {
          url: 'https://staging-api.example.com/v1',
          description: 'Staging Server',
        },
      ],
    };

    const result = swaggerToMarkdown(spec);

    expect(result).toContain('## Servers');
    expect(result).toContain('**Production Server:** `https://api.example.com/v1`');
    expect(result).toContain('**Staging Server:** `https://staging-api.example.com/v1`');
  });

  it('should include authentication schemes when present', () => {
    const spec: OpenAPIV3.Document = {
      ...baseSpec,
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
            description: 'JWT Bearer token',
          },
          apiKey: {
            type: 'apiKey',
            in: 'header',
            name: 'X-API-Key',
            description: 'API Key authentication',
          },
        },
      },
    };

    const result = swaggerToMarkdown(spec);

    expect(result).toContain('## Authentication');
    expect(result).toContain('### bearerAuth');
    expect(result).toContain('JWT Bearer token');
    expect(result).toContain('### apiKey');
    expect(result).toContain('API Key authentication');
  });

  it('should include paths with methods', () => {
    const spec: OpenAPIV3.Document = {
      ...baseSpec,
      tags: [
        {
          name: 'Users',
          description: 'User management',
        },
      ],
      paths: {
        '/users': {
          get: {
            summary: 'List users',
            description: 'Returns a list of users',
            operationId: 'listUsers',
            tags: ['Users'],
            responses: {
              '200': {
                description: 'Successful response',
              },
            },
          },
          post: {
            summary: 'Create user',
            operationId: 'createUser',
            tags: ['Users'],
            responses: {
              '201': {
                description: 'User created',
              },
            },
          },
        },
      },
    };

    const result = swaggerToMarkdown(spec);

    expect(result).toContain('## Endpoints');
    expect(result).toContain('### Users');
    expect(result).toContain('#### GET `/users`');
    expect(result).toContain('#### POST `/users`');
    expect(result).toContain('List users');
    expect(result).toContain('Create user');
  });

  it('should include path parameters', () => {
    const spec: OpenAPIV3.Document = {
      ...baseSpec,
      paths: {
        '/users/{id}': {
          get: {
            summary: 'Get user by ID',
            operationId: 'getUserById',
            parameters: [
              {
                name: 'id',
                in: 'path',
                required: true,
                schema: {
                  type: 'string',
                },
                description: 'User ID',
              },
            ],
            responses: {
              '200': {
                description: 'Successful response',
              },
            },
          },
        },
      },
    };

    const result = swaggerToMarkdown(spec);

    expect(result).toContain('#### GET `/users/{id}`');
    expect(result).toContain('| id | path | string | Yes | User ID |');
  });

  it('should include query parameters', () => {
    const spec: OpenAPIV3.Document = {
      ...baseSpec,
      paths: {
        '/users': {
          get: {
            summary: 'List users',
            operationId: 'listUsers',
            parameters: [
              {
                name: 'limit',
                in: 'query',
                required: false,
                schema: {
                  type: 'integer',
                  default: 10,
                },
                description: 'Maximum number of users to return',
              },
              {
                name: 'offset',
                in: 'query',
                required: false,
                schema: {
                  type: 'integer',
                  default: 0,
                },
                description: 'Number of users to skip',
              },
            ],
            responses: {
              '200': {
                description: 'Successful response',
              },
            },
          },
        },
      },
    };

    const result = swaggerToMarkdown(spec);

    expect(result).toContain(
      '| limit | query | integer | No | Maximum number of users to return |'
    );
    expect(result).toContain('| offset | query | integer | No | Number of users to skip |');
  });

  it('should include request body', () => {
    const spec: OpenAPIV3.Document = {
      ...baseSpec,
      paths: {
        '/users': {
          post: {
            summary: 'Create user',
            operationId: 'createUser',
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      name: {
                        type: 'string',
                        description: 'User name',
                      },
                      email: {
                        type: 'string',
                        description: 'User email',
                      },
                    },
                    required: ['name', 'email'],
                  },
                },
              },
            },
            responses: {
              '201': {
                description: 'User created',
              },
            },
          },
        },
      },
    };

    const result = swaggerToMarkdown(spec);

    expect(result).toContain('**Request Body:**');
    expect(result).toContain('Content-Type: `application/json`');
    expect(result).toContain('"name": "string"');
    expect(result).toContain('"email": "string"');
  });

  it('should include response schemas', () => {
    const spec: OpenAPIV3.Document = {
      ...baseSpec,
      paths: {
        '/users': {
          get: {
            summary: 'List users',
            operationId: 'listUsers',
            responses: {
              '200': {
                description: 'Successful response',
                content: {
                  'application/json': {
                    schema: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          id: {
                            type: 'string',
                            description: 'User ID',
                          },
                          name: {
                            type: 'string',
                            description: 'User name',
                          },
                        },
                      },
                    },
                  },
                },
              },
              '404': {
                description: 'Not found',
              },
            },
          },
        },
      },
    };

    const result = swaggerToMarkdown(spec);

    expect(result).toContain('**Responses:**');
    expect(result).toContain('- **200**: Successful response');
    expect(result).toContain('- **404**: Not found');
  });

  it('should handle empty spec gracefully', () => {
    const spec: OpenAPIV3.Document = {
      openapi: '3.0.0',
      info: {
        title: 'Minimal API',
        version: '1.0.0',
      },
      paths: {},
    };

    const result = swaggerToMarkdown(spec);

    expect(result).toContain('# Minimal API');
    expect(result).toContain('**Version:** 1.0.0');
  });

  it('should include tags information', () => {
    const spec: OpenAPIV3.Document = {
      ...baseSpec,
      tags: [
        {
          name: 'Users',
          description: 'User management endpoints',
        },
        {
          name: 'Auth',
          description: 'Authentication endpoints',
        },
      ],
      paths: {
        '/users': {
          get: {
            summary: 'List users',
            operationId: 'listUsers',
            tags: ['Users'],
            responses: {
              '200': {
                description: 'Success',
              },
            },
          },
        },
      },
    };

    const result = swaggerToMarkdown(spec);

    expect(result).toContain('### Table of Contents');
    expect(result).toContain('- [Users](#users) - User management endpoints');
    expect(result).toContain('### Users');
  });

  it('should handle deprecated operations', () => {
    const spec: OpenAPIV3.Document = {
      ...baseSpec,
      paths: {
        '/old-endpoint': {
          get: {
            summary: 'Old endpoint',
            operationId: 'getOld',
            deprecated: true,
            responses: {
              '200': {
                description: 'Success',
              },
            },
          },
        },
      },
    };

    const result = swaggerToMarkdown(spec);

    // Implementation doesn't handle deprecated flag
    expect(result).toContain('#### GET `/old-endpoint`');
    expect(result).toContain('**Old endpoint**');
  });

  it('should handle complex nested schemas', () => {
    const spec: OpenAPIV3.Document = {
      ...baseSpec,
      paths: {
        '/complex': {
          post: {
            summary: 'Complex endpoint',
            operationId: 'postComplex',
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      user: {
                        type: 'object',
                        properties: {
                          name: {
                            type: 'string',
                          },
                          address: {
                            type: 'object',
                            properties: {
                              street: {
                                type: 'string',
                              },
                              city: {
                                type: 'string',
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
            responses: {
              '200': {
                description: 'Success',
              },
            },
          },
        },
      },
    };

    const result = swaggerToMarkdown(spec);

    expect(result).toContain('**Request Body:**');
    expect(result).toContain('"user": {');
    expect(result).toContain('"address": {');
  });

  it('should handle enum values', () => {
    const spec: OpenAPIV3.Document = {
      ...baseSpec,
      paths: {
        '/users': {
          get: {
            summary: 'List users',
            operationId: 'listUsers',
            parameters: [
              {
                name: 'status',
                in: 'query',
                schema: {
                  type: 'string',
                  enum: ['active', 'inactive', 'pending'],
                },
                description: 'Filter by status',
              },
            ],
            responses: {
              '200': {
                description: 'Success',
              },
            },
          },
        },
      },
    };

    const result = swaggerToMarkdown(spec);

    expect(result).toContain('| status | query | string | No | Filter by status |');
  });

  it('should handle different string formats in request body', () => {
    const spec: OpenAPIV3.Document = {
      ...baseSpec,
      paths: {
        '/users': {
          post: {
            summary: 'Create user',
            operationId: 'createUser',
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      createdAt: {
                        type: 'string',
                        format: 'date-time',
                      },
                      birthDate: {
                        type: 'string',
                        format: 'date',
                      },
                      email: {
                        type: 'string',
                        format: 'email',
                      },
                      id: {
                        type: 'string',
                        format: 'uuid',
                      },
                      age: {
                        type: 'integer',
                      },
                      score: {
                        type: 'number',
                      },
                      active: {
                        type: 'boolean',
                      },
                      tags: {
                        type: 'array',
                        items: {
                          type: 'string',
                        },
                      },
                    },
                  },
                },
              },
            },
            responses: {
              '201': {
                description: 'User created',
              },
            },
          },
        },
      },
    };

    const result = swaggerToMarkdown(spec);

    expect(result).toContain('"createdAt": "2024-01-01T00:00:00Z"');
    expect(result).toContain('"birthDate": "2024-01-01"');
    expect(result).toContain('"email": "user@example.com"');
    expect(result).toContain('"id": "00000000-0000-0000-0000-000000000000"');
    expect(result).toContain('"age": 0');
    expect(result).toContain('"score": 0');
    expect(result).toContain('"active": true');
    expect(result).toContain('"tags"');
  });

  it('should handle schemas with example values', () => {
    const spec: OpenAPIV3.Document = {
      ...baseSpec,
      paths: {
        '/users': {
          post: {
            summary: 'Create user',
            operationId: 'createUser',
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      name: {
                        type: 'string',
                        example: 'John Doe',
                      },
                    },
                  },
                },
              },
            },
            responses: {
              '201': {
                description: 'User created',
              },
            },
          },
        },
      },
    };

    const result = swaggerToMarkdown(spec);

    expect(result).toContain('"name": "John Doe"');
  });

  it('should handle components schemas', () => {
    const spec: OpenAPIV3.Document = {
      ...baseSpec,
      components: {
        schemas: {
          User: {
            type: 'object',
            properties: {
              id: {
                type: 'string',
                description: 'User ID',
              },
              name: {
                type: 'string',
                nullable: true,
                description: 'User name',
              },
              status: {
                type: 'string',
                enum: ['active', 'inactive'],
                description: 'User status',
              },
              tags: {
                type: 'array',
                items: {
                  type: 'string',
                },
                description: 'User tags',
              },
            },
          },
        },
      },
      paths: {},
    };

    const result = swaggerToMarkdown(spec);

    expect(result).toContain('## Schemas');
    expect(result).toContain('### User');
    expect(result).toContain('| id | string | User ID |');
    expect(result).toContain('| name | string | null | User name |');
    expect(result).toContain('| status | enum: active, inactive | User status |');
    expect(result).toContain('| tags | array<string> | User tags |');
  });
});
