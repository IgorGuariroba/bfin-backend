import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'BFIN API',
      version: '1.0.0',
      description: 'Banking Finance API - Sistema de gestão financeira pessoal',
      contact: {
        name: 'Igor Guariroba',
        email: 'support@bfin.com',
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT',
      },
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Development server',
      },
      {
        url: 'https://api.bfin.com',
        description: 'Production server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter your JWT token in the format: Bearer {token}',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            error: {
              type: 'string',
              description: 'Error type',
            },
            message: {
              type: 'string',
              description: 'Error message',
            },
          },
        },
        User: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
            },
            email: {
              type: 'string',
              format: 'email',
            },
            full_name: {
              type: 'string',
            },
          },
        },
        Account: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
            },
            account_name: {
              type: 'string',
            },
            account_type: {
              type: 'string',
              enum: ['checking', 'savings', 'investment'],
            },
            total_balance: {
              type: 'number',
              format: 'decimal',
            },
            available_balance: {
              type: 'number',
              format: 'decimal',
            },
            locked_balance: {
              type: 'number',
              format: 'decimal',
            },
            emergency_reserve: {
              type: 'number',
              format: 'decimal',
            },
            currency: {
              type: 'string',
              default: 'BRL',
            },
            is_default: {
              type: 'boolean',
            },
            created_at: {
              type: 'string',
              format: 'date-time',
            },
            updated_at: {
              type: 'string',
              format: 'date-time',
            },
          },
        },
        Category: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
            },
            name: {
              type: 'string',
            },
            type: {
              type: 'string',
              enum: ['income', 'expense'],
            },
            color: {
              type: 'string',
              nullable: true,
            },
            icon: {
              type: 'string',
              nullable: true,
            },
            is_system: {
              type: 'boolean',
            },
            created_at: {
              type: 'string',
              format: 'date-time',
            },
          },
        },
        Transaction: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
            },
            account_id: {
              type: 'string',
              format: 'uuid',
            },
            category_id: {
              type: 'string',
              format: 'uuid',
              nullable: true,
            },
            type: {
              type: 'string',
              enum: ['income', 'fixed_expense', 'variable_expense'],
            },
            amount: {
              type: 'number',
              format: 'decimal',
            },
            description: {
              type: 'string',
              nullable: true,
            },
            due_date: {
              type: 'string',
              format: 'date-time',
            },
            executed_date: {
              type: 'string',
              format: 'date-time',
              nullable: true,
            },
            status: {
              type: 'string',
              enum: ['pending', 'executed', 'cancelled', 'locked'],
            },
            is_recurring: {
              type: 'boolean',
            },
            recurrence_pattern: {
              type: 'string',
              enum: ['monthly', 'weekly', 'yearly'],
              nullable: true,
            },
            tags: {
              type: 'array',
              items: {
                type: 'string',
              },
            },
            created_at: {
              type: 'string',
              format: 'date-time',
            },
          },
        },
      },
    },
    tags: [
      {
        name: 'Authentication',
        description: 'Endpoints de autenticação de usuários',
      },
      {
        name: 'Accounts',
        description: 'Gerenciamento de contas financeiras',
      },
      {
        name: 'Categories',
        description: 'Gerenciamento de categorias de transações',
      },
      {
        name: 'Transactions',
        description: 'Gerenciamento de transações financeiras',
      },
      {
        name: 'Suggestions',
        description: 'Sugestões de gastos inteligentes',
      },
      {
        name: 'Invitations',
        description: 'Convites para contas compartilhadas',
      },
    ],
  },
  apis: ['./src/routes/*.ts', './src/controllers/*.ts'],
};

export const swaggerSpec = swaggerJsdoc(options);
