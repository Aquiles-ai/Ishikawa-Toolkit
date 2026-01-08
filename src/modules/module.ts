import { ToolCompiler } from "./compiler.js";
import { readFile, mkdir, copyFile, writeFile, access, readdir } from 'fs/promises';
import { exec } from 'child_process';
import { promisify } from 'util';
import { join } from 'path';
import { pathToFileURL } from 'url';

const execAsync = promisify(exec);

export interface ToolMetadata {
    name: string;
    description: string;
    parameters: any;
    dependencies?: Record<string, string>;
}

export interface LoadedTool {
    metadata: ToolMetadata;
    execute: (...args: any[]) => Promise<any>;
    path: string;
}

export async function ToolRegister(
    name: string, 
    code_path: string, 
    auto_install: boolean, 
    json_llm: string
) {
    const metadata = await parseJsonInput(json_llm);

    const toolPath = join(process.cwd(), 'tools', name);
    await mkdir(toolPath, { recursive: true });

    const targetCodePath = join(toolPath, 'index.ts');
    await copyFile(code_path, targetCodePath);

    const metadataPath = join(toolPath, 'function.json');
    await writeFile(metadataPath, JSON.stringify(metadata, null, 2));

    await createPackageJson(toolPath, name, metadata.dependencies || {});

    if (auto_install) {
        await installDependencies(toolPath);
    }

    await ToolCompiler(toolPath);
    
    console.log(`Tool "${name}" registered successfully at: ${toolPath}`);
}

async function parseJsonInput(input: string): Promise<any> {
    try {
        return JSON.parse(input);
    } catch {
        try {
            const fileContent = await readFile(input, 'utf-8');
            return JSON.parse(fileContent);
        } catch (error) {
            throw new Error(`X Could not parse JSON: ${error}`);
        }
    }
}

async function createPackageJson(
    toolPath: string, 
    name: string, 
    dependencies: Record<string, string>
): Promise<void> {
    const packageJson = {
        name: `tool-${name}`,
        version: "1.0.0",
        type: "module",
        dependencies: dependencies
    };
    
    const packagePath = join(toolPath, 'package.json');
    await writeFile(packagePath, JSON.stringify(packageJson, null, 2));
}

async function installDependencies(toolPath: string): Promise<void> {
    try {
        console.log(`Installing dependencies at: ${toolPath}`);

        await execAsync('npm install', { 
            cwd: toolPath 
        });
        
        console.log('Dependencies installed successfully');
    } catch (error) {
        throw new Error(`X Error installing dependencies: ${error}`);
    }
}

export async function ToolLoader(name: string): Promise<LoadedTool> {
    const toolPath = join(process.cwd(), 'tools', name);
    
    // Step 1: Verify tool exists
    try {
        await access(toolPath);
    } catch {
        throw new Error(`X Tool "${name}" not found at: ${toolPath}`);
    }

    // Step 2: Load function.json metadata
    const metadataPath = join(toolPath, 'function.json');
    let metadata: ToolMetadata;
    
    try {
        const metadataContent = await readFile(metadataPath, 'utf-8');
        metadata = JSON.parse(metadataContent);
    } catch (error) {
        throw new Error(`X Could not load metadata for tool "${name}": ${error}`);
    }

    // Step 3: Load compiled function
    const compiledPath = join(toolPath, 'dist', 'index.js');
    
    try {
        await access(compiledPath);
    } catch {
        throw new Error(`X Tool "${name}" not compiled. Run ToolCompiler first.`);
    }

    // Step 4: Dynamic import of the compiled module
    let toolModule: any;
    
    try {
        const fileUrl = pathToFileURL(compiledPath).href;
        toolModule = await import(fileUrl);
    } catch (error) {
        throw new Error(`X Could not import tool "${name}": ${error}`);
    }

    // Step 5: Get the exported function
    const execute = toolModule.default || toolModule.execute || toolModule[name];
    
    if (!execute || typeof execute !== 'function') {
        throw new Error(`X Tool "${name}" does not export a valid function`);
    }

    console.log(`Tool "${name}" loaded successfully`);

    return {
        metadata,
        execute,
        path: toolPath
    };
}

export async function ToolList(): Promise<string[]> {
    const toolsDir = join(process.cwd(), 'tools');
    
    try {
        const entries = await readdir(toolsDir, { withFileTypes: true });
        const tools = entries
            .filter(entry => entry.isDirectory())
            .map(entry => entry.name);
        
        console.log(`Found ${tools.length} tools`);
        return tools;
    } catch (error) {
        throw new Error(`X Could not list tools: ${error}`);
    }
}