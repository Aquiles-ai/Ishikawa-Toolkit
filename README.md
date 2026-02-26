<div align="center">

# Ishikawa-Toolkit

<img src="https://res.cloudinary.com/dmtomxyvm/image/upload/v1767669134/ishikawa_toolkit_lrztkl.png" alt="Ishikawa-Toolkit" width="800"/>

Extensible framework for creating and managing LLM function calling. Build custom TypeScript tools with isolated dependencies and automatic metadata for integration with any language model.
</div>

## Installation

```bash
npm i @aquiles-ai/ishikawa-toolkit
```

## Quick Start

### 1. Create your tool function

Create a file `calculator.ts`:

```typescript
export default function calculator({a, b, operation}: {a: number; b: number; operation: string}) {
    switch(operation) {
        case 'add': return a + b;
        case 'subtract': return a - b;
        case 'multiply': return a * b;
        case 'divide': return a / b;
        default: throw new Error('Invalid operation');
    }
}
```

> **Important:** The `name` in the schema must match the exported function name in your `.ts` file. In this case, the file exports `function calculator` so the schema name must be `"calculator"`.

### 2. Define the schema

**Option A — Using `zodToJsonSchema()`**

Define the schema in code using Zod. No separate file needed.

```typescript
import { zodToJsonSchema } from '@aquiles-ai/ishikawa-toolkit';
import * as z from 'zod';

const schema = z.object({
    a: z.number().meta({ description: 'First number' }),
    b: z.number().meta({ description: 'Second number' }),
    operation: z.enum(['add', 'subtract', 'multiply', 'divide'])
        .meta({ description: 'Operation to perform' })
});

const metadata = zodToJsonSchema('calculator', 'Performs basic mathematical operations', schema, {
    'mathjs': '^12.0.0' // optional dependencies
});
```

**Option B — Raw JSON Schema file**

Create `calculator-metadata.json`:

```json
{
    "type": "function",
    "name": "calculator",
    "description": "Performs basic mathematical operations",
    "parameters": {
        "type": "object",
        "properties": {
            "a": { "type": "number", "description": "First number" },
            "b": { "type": "number", "description": "Second number" },
            "operation": { 
                "type": "string", 
                "enum": ["add", "subtract", "multiply", "divide"],
                "description": "Operation to perform"
            }
        },
        "required": ["a", "b", "operation"]
    },
    "dependencies": {
        "mathjs": "^12.0.0"
    }
}
```

### 3. Register and use the tool

```typescript
import { ToolManager } from '@aquiles-ai/ishikawa-toolkit';

const manager = new ToolManager();

// Option A — register with zodToJsonSchema output
await manager.register('./calculator.ts', metadata);

// Option B — register with a path to JSON file
await manager.register('./calculator.ts', './calculator-metadata.json');

// Load and execute
const tool = await manager.getTool('calculator');

// Access metadata
console.log(tool.metadata.description);
// Output: "Performs basic mathematical operations"

// Execute the tool
const result = await tool.execute({a: 10, b: 5, operation: 'add'});
console.log(result); // Output: 15

// Or use shortcut
const result2 = await manager.executeTool('calculator', {a: 20, b: 4, operation: 'divide'});
console.log(result2); // Output: 5

// List all registered tools
const tools = await manager.list();
console.log(tools); // Output: ['calculator', ...]
```

## Environment Variables (Optional)

If your tool requires environment variables, you can provide a `.env` file during registration. This parameter is optional and accepts either a file path or direct content.

**Important:** The toolkit automatically loads the `.env` file for each tool before execution. You **do not need** to call `dotenv.config()` in your tool code - just access `process.env` directly.

### Complete Example with Environment Variables

**1. Create your tool that uses environment variables**

Create `api-client.ts`:
```typescript
// NO need to import or call dotenv.config() - env vars are loaded automatically!

export default async function apiClient({endpoint}: {endpoint: string}) {
    const apiKey = process.env.API_KEY;
    const baseUrl = process.env.API_URL;
    
    if (!apiKey) {
        throw new Error('API_KEY not found in environment');
    }
    
    const response = await fetch(`${baseUrl}${endpoint}`, {
        headers: {
            'Authorization': `Bearer ${apiKey}`
        }
    });
    
    return await response.json();
}
```

**2. Define the schema**

```typescript
import { zodToJsonSchema } from '@aquiles-ai/ishikawa-toolkit';
import * as z from 'zod';

const metadata = zodToJsonSchema(
    'apiClient',
    'Makes authenticated API requests',
    z.object({
        endpoint: z.string().meta({ description: 'API endpoint to call' })
    })
);
```

**3. Register with environment variables**

Using a `.env` file path:
```typescript
await manager.register('./api-client.ts', metadata, './config/.env');
```

Or using direct `.env` content:
```typescript
await manager.register(
    './api-client.ts',
    metadata,
    'API_KEY=your-key-here\nAPI_URL=https://api.example.com'
);
```

The same works with a JSON path:
```typescript
await manager.register('./api-client.ts', './api-metadata.json', './config/.env');
```

**4. Use the tool**
```typescript
const result = await manager.executeTool('api-client', {
    endpoint: '/users/123'
});
```

### How Environment Variables Work

- Each tool gets its **own isolated** `.env` file in its execution directory
- Environment variables are loaded **automatically** before the tool executes
- After execution, the environment is restored to prevent pollution between tools
- You simply access variables via `process.env.VARIABLE_NAME` - no manual configuration needed

## How Isolation Works

Each registered tool lives in its own directory under the toolkit's data path:

```
TOOLS_BASE_DIR/
└── tools/
    ├── calculator/
    │   ├── index.ts
    │   ├── function.json
    │   ├── package.json
    │   └── dist/
    │       ├── index.js
    │       └── node_modules/   ← mathjs@12 isolated here
    └── data-processor/
        └── dist/
            └── node_modules/   ← mathjs@11 isolated here
```

When a tool is loaded, it is imported via `import(fileURL)` from its own directory. Node.js resolves dependencies relative to the imported file's location, so each tool loads its own versions of packages with zero conflicts no workers or separate processes needed.

## CLI

List all tools currently registered in the system:

```bash
npx ishikawa list
```

Example output:

```
calculator
api-client
```

## Using with Local LLMs

Ishikawa-toolkit works seamlessly with local LLM servers like vLLM. Here's how to set up function calling with a local model:

### 1. Start vLLM Server

Start your vLLM server with tool calling enabled:
```bash
vllm serve openai/gpt-oss-20b \
    --served-model-name gpt-oss-20b \
    --host 0.0.0.0 \
    --port 8000 \
    --async-scheduling \
    --enable-auto-tool-choice \
    --tool-call-parser openai \
    --api-key dummyapikey
```

### 2. Implement the Agent Loop

Here's a complete example using the `calculator` tool from the Quick Start section:

```typescript
import OpenAI from "openai";
import { ToolManager } from "@aquiles-ai/ishikawa-toolkit";

const client = new OpenAI({ 
    baseURL: "http://localhost:8000/v1", 
    apiKey: "dummyapikey"
});

const tools = new ToolManager();
const namesTools = await tools.listTools();

const allToolsMetadata = await Promise.all(
    namesTools.map(async (toolName) => {
        try {
            return await tools.getMetadataTool(toolName);
        } catch (error) {
            console.error(`X Error loading ${toolName}:`, error);
            return null;
        }
    })
);

const toolsMetadata = allToolsMetadata.filter(m => m !== null).map(m => ({
    type: m.type,
    name: m.name,
    description: m.description,
    parameters: m.parameters
}));

let input = [
    { 
        role: "user", 
        content: "Can you validate the basic operations using the tool (The tool you need to use is the 'calculator', always use it)?" 
    },
];

let response = await client.responses.create({
    model: "gpt-oss-20b",
    tools: toolsMetadata,
    input: input,
});

for (const item of response.output) {
    if (item.type == "function_call") {
        const cleanName = item.name.split('<|')[0].trim();
        
        if (namesTools.includes(cleanName)) {
            console.log("Running the tool: " + cleanName);
            
            let parsedArgs = {};
            try {
                parsedArgs = typeof item.arguments === "string" 
                    ? JSON.parse(item.arguments) 
                    : item.arguments ?? {};
            } catch (e) {
                console.error("X Error parsing function arguments:", e);
            }

            try {
                const result = await tools.executeTool(cleanName, parsedArgs);
                console.log(`Result: ${result}`);

                input.push({
                    ...item,
                    name: cleanName
                });
                
                input.push({
                    type: "function_call_output",
                    call_id: item.call_id,
                    output: String(result), 
                });
            } catch (err) {
                console.error("X Tool execution error:", err);
                input.push(item);
                input.push({
                    type: "function_call_output",
                    call_id: item.call_id,
                    output: JSON.stringify({ error: String(err) }),
                });
            }
        }
    }
}

const response2 = await client.responses.create({
    model: "gpt-oss-20b",
    instructions: "Answer based on the results obtained from the tool. What inputs did you provide and what output did you obtain?",
    tools: toolsMetadata,
    input: input,
});

console.log("Final output:");
console.log(response2.output_text);
```

For more models and parser options, see the [vLLM documentation](https://docs.vllm.ai/en/latest/features/tool_calling/).