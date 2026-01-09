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

### 2. Create metadata JSON

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

// Register the tool
await manager.createTool(
    'calculator',
    './calculator.ts',
    true, // auto-install dependencies
    './calculator-metadata.json'
);

// Load and execute
const tool = await manager.getTool('calculator');

// Access metadata
console.log(tool.metadata.description);
// Output: "Performs basic mathematical operations"

// Execute the tool
const result = await tool.execute({a: 10, b: 5, operation:'add'});
console.log(result); // Output: 15

// Or use shortcut
const result2 = await manager.executeTool('calculator', {a: 20, b: 4, operation: 'divide'});
console.log(result2); // Output: 5

// List all registered tools
const tools = await manager.list();
console.log(tools); // Output: ['calculator', ...]
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
            console.error(`X Error cargando ${toolName}:`, error);
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
    input,
});

// console.log("Response 1:", response);

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