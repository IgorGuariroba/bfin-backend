import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { swaggerSpec } from '../src/config/swagger';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const outputDir = path.join(__dirname, '../openapi');
const outputFile = path.join(outputDir, 'openapi.json');

// Ensure output directory exists
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Validate spec has required fields
if (!swaggerSpec.openapi || !swaggerSpec.info || !swaggerSpec.paths) {
  console.error('❌ Invalid OpenAPI specification');
  console.error('Missing required fields: openapi, info, or paths');
  process.exit(1);
}

// Write spec to file
fs.writeFileSync(outputFile, JSON.stringify(swaggerSpec, null, 2), 'utf-8');

console.log('✅ OpenAPI spec exported successfully!');
console.log(`   Location: ${outputFile}`);
console.log(`   OpenAPI Version: ${swaggerSpec.openapi}`);
console.log(`   API Title: ${swaggerSpec.info.title}`);
console.log(`   API Version: ${swaggerSpec.info.version}`);
console.log(`   Paths: ${Object.keys(swaggerSpec.paths).length}`);
console.log(`   Tags: ${swaggerSpec.tags?.length || 0}`);
