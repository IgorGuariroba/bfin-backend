import type { OpenAPIV3 } from 'openapi-types';

type SwaggerSpec = OpenAPIV3.Document;

export function swaggerToMarkdown(spec: SwaggerSpec): string {
  const lines: string[] = [];

  // Title and description
  lines.push(`# ${spec.info.title}`);
  lines.push('');
  if (spec.info.description) {
    lines.push(spec.info.description);
    lines.push('');
  }
  lines.push(`**Version:** ${spec.info.version}`);
  lines.push('');

  // Contact info
  if (spec.info.contact) {
    lines.push('## Contact');
    if (spec.info.contact.name) {
      lines.push(`- **Name:** ${spec.info.contact.name}`);
    }
    if (spec.info.contact.email) {
      lines.push(`- **Email:** ${spec.info.contact.email}`);
    }
    lines.push('');
  }

  // License
  if (spec.info.license) {
    lines.push('## License');
    lines.push(`[${spec.info.license.name}](${spec.info.license.url || '#'})`);
    lines.push('');
  }

  // Servers
  if (spec.servers && spec.servers.length > 0) {
    lines.push('## Servers');
    lines.push('');
    for (const server of spec.servers) {
      lines.push(`- **${server.description || 'Server'}:** \`${server.url}\``);
    }
    lines.push('');
  }

  // Security Schemes
  if (spec.components?.securitySchemes) {
    lines.push('## Authentication');
    lines.push('');
    for (const [name, scheme] of Object.entries(spec.components.securitySchemes)) {
      const s = scheme as OpenAPIV3.SecuritySchemeObject;
      lines.push(`### ${name}`);
      lines.push(`- **Type:** ${s.type}`);
      if ('scheme' in s) {
        lines.push(`- **Scheme:** ${s.scheme}`);
      }
      if ('bearerFormat' in s) {
        lines.push(`- **Format:** ${s.bearerFormat}`);
      }
      if (s.description) {
        lines.push(`- **Description:** ${s.description}`);
      }
      lines.push('');
    }
  }

  // Group endpoints by tag
  const taggedPaths: Record<
    string,
    Array<{ method: string; path: string; operation: OpenAPIV3.OperationObject }>
  > = {};
  const untaggedPaths: Array<{
    method: string;
    path: string;
    operation: OpenAPIV3.OperationObject;
  }> = [];

  if (spec.paths) {
    for (const [path, pathItem] of Object.entries(spec.paths)) {
      if (!pathItem) {
        continue;
      }
      const methods = ['get', 'post', 'put', 'patch', 'delete'] as const;
      for (const method of methods) {
        const operation = pathItem[method] as OpenAPIV3.OperationObject | undefined;
        if (operation) {
          const tags = operation.tags || [];
          if (tags.length > 0) {
            for (const tag of tags) {
              if (!taggedPaths[tag]) {
                taggedPaths[tag] = [];
              }
              taggedPaths[tag].push({ method, path, operation });
            }
          } else {
            untaggedPaths.push({ method, path, operation });
          }
        }
      }
    }
  }

  // Endpoints section
  lines.push('## Endpoints');
  lines.push('');

  // Table of contents
  if (spec.tags) {
    lines.push('### Table of Contents');
    lines.push('');
    for (const tag of spec.tags) {
      const anchor = tag.name.toLowerCase().replace(/\s+/g, '-');
      lines.push(`- [${tag.name}](#${anchor})${tag.description ? ` - ${tag.description}` : ''}`);
    }
    lines.push('');
  }

  // Render each tag section
  if (spec.tags) {
    for (const tag of spec.tags) {
      lines.push(`### ${tag.name}`);
      if (tag.description) {
        lines.push('');
        lines.push(tag.description);
      }
      lines.push('');

      const endpoints = taggedPaths[tag.name] || [];
      for (const { method, path, operation } of endpoints) {
        renderEndpoint(lines, method, path, operation);
      }
    }
  }

  // Untagged endpoints
  if (untaggedPaths.length > 0) {
    lines.push('### Other Endpoints');
    lines.push('');
    for (const { method, path, operation } of untaggedPaths) {
      renderEndpoint(lines, method, path, operation);
    }
  }

  // Schemas
  if (spec.components?.schemas && Object.keys(spec.components.schemas).length > 0) {
    lines.push('## Schemas');
    lines.push('');

    for (const [name, schema] of Object.entries(spec.components.schemas)) {
      lines.push(`### ${name}`);
      lines.push('');
      renderSchema(lines, schema as OpenAPIV3.SchemaObject);
      lines.push('');
    }
  }

  return lines.join('\n');
}

function renderEndpoint(
  lines: string[],
  method: string,
  path: string,
  operation: OpenAPIV3.OperationObject
): void {
  lines.push(`#### ${method.toUpperCase()} \`${path}\``);
  lines.push('');

  if (operation.summary) {
    lines.push(`**${operation.summary}**`);
    lines.push('');
  }

  if (operation.description) {
    lines.push(operation.description);
    lines.push('');
  }

  // Parameters
  if (operation.parameters && operation.parameters.length > 0) {
    lines.push('**Parameters:**');
    lines.push('');
    lines.push('| Name | In | Type | Required | Description |');
    lines.push('|------|-----|------|----------|-------------|');
    for (const param of operation.parameters) {
      const p = param as OpenAPIV3.ParameterObject;
      const schema = p.schema as OpenAPIV3.SchemaObject | undefined;
      const type = schema?.type || 'any';
      lines.push(
        `| ${p.name} | ${p.in} | ${type} | ${p.required ? 'Yes' : 'No'} | ${p.description || '-'} |`
      );
    }
    lines.push('');
  }

  // Request Body
  if (operation.requestBody) {
    const body = operation.requestBody as OpenAPIV3.RequestBodyObject;
    lines.push('**Request Body:**');
    lines.push('');
    if (body.description) {
      lines.push(body.description);
      lines.push('');
    }
    if (body.content) {
      for (const [contentType, mediaType] of Object.entries(body.content)) {
        lines.push(`Content-Type: \`${contentType}\``);
        lines.push('');
        if (mediaType.schema) {
          lines.push('```json');
          lines.push(
            JSON.stringify(schemaToExample(mediaType.schema as OpenAPIV3.SchemaObject), null, 2)
          );
          lines.push('```');
          lines.push('');
        }
      }
    }
  }

  // Responses
  if (operation.responses) {
    lines.push('**Responses:**');
    lines.push('');
    for (const [code, response] of Object.entries(operation.responses)) {
      const resp = response as OpenAPIV3.ResponseObject;
      lines.push(`- **${code}**: ${resp.description || 'No description'}`);
    }
    lines.push('');
  }

  lines.push('---');
  lines.push('');
}

function renderSchema(lines: string[], schema: OpenAPIV3.SchemaObject): void {
  if (schema.type === 'object' && schema.properties) {
    lines.push('| Property | Type | Description |');
    lines.push('|----------|------|-------------|');
    for (const [name, prop] of Object.entries(schema.properties)) {
      const p = prop as OpenAPIV3.SchemaObject;
      const type = formatType(p);
      lines.push(`| ${name} | ${type} | ${p.description || '-'} |`);
    }
  } else {
    lines.push(`Type: \`${schema.type || 'object'}\``);
  }
}

function formatType(schema: OpenAPIV3.SchemaObject): string {
  if (schema.type === 'array') {
    const items = schema.items as OpenAPIV3.SchemaObject | undefined;
    return `array<${items?.type || 'any'}>`;
  }
  if (schema.enum) {
    return `enum: ${schema.enum.join(', ')}`;
  }
  let type = schema.type || 'any';
  if (schema.format) {
    type += ` (${schema.format})`;
  }
  if (schema.nullable) {
    type += ' | null';
  }
  return type;
}

function schemaToExample(schema: OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject): unknown {
  if ('$ref' in schema) {
    return { $ref: schema.$ref };
  }

  if (schema.example !== undefined) {
    return schema.example;
  }

  switch (schema.type) {
    case 'string':
      if (schema.enum) {
        return schema.enum[0];
      }
      if (schema.format === 'date-time') {
        return '2024-01-01T00:00:00Z';
      }
      if (schema.format === 'date') {
        return '2024-01-01';
      }
      if (schema.format === 'email') {
        return 'user@example.com';
      }
      if (schema.format === 'uuid') {
        return '00000000-0000-0000-0000-000000000000';
      }
      return 'string';
    case 'number':
    case 'integer':
      return 0;
    case 'boolean':
      return true;
    case 'array':
      if (schema.items) {
        return [schemaToExample(schema.items as OpenAPIV3.SchemaObject)];
      }
      return [];
    case 'object':
      if (schema.properties) {
        const obj: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(schema.properties)) {
          obj[key] = schemaToExample(value as OpenAPIV3.SchemaObject);
        }
        return obj;
      }
      return {};
    default:
      return null;
  }
}
