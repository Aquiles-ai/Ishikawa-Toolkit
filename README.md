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
export default function calculator(a: number, b: number, operation: string) {
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
const result = await tool.execute(10, 5, 'add');
console.log(result); // Output: 15

// Or use shortcut
const result2 = await manager.execute('calculator', 20, 4, 'divide');
console.log(result2); // Output: 5

// List all registered tools
const tools = await manager.list();
console.log(tools); // Output: ['calculator', ...]
```
