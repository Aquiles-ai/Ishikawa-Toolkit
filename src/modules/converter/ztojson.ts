import * as z from 'zod';

export function zodToJsonSchema(
  name: string,
  description: string,
  schema: z.ZodTypeAny,
  dependencies: Record<string, string> = {}
) {
  const rawSchema = z.toJSONSchema(schema, { target: 'draft-07' });

  const { $schema, additionalProperties, ...cleanParameters } = rawSchema as any;

  return {
    type: 'function',
    name,
    description,
    parameters: cleanParameters,
    dependencies
  };
}

// Test

//const schema = z.object({
//  a: z.number().meta({ description: 'First number' }),
//  b: z.number().meta({ description: 'Second number' }),
//  operation: z.enum(['add', 'subtract', 'multiply', 'divide'])
//    .meta({ description: 'Operation to perform' })
//});

//const JSONTest = zodToJsonSchema(
//  'calculator',
//  'Performs basic mathematical operations',
//  schema,
//  { 'mathjs': '^12.0.0' }
//);

//console.log(JSONTest);