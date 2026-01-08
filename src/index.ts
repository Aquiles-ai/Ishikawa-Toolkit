import { ToolRegister, ToolLoader, ToolList, LoadedTool } from "./modules/module.js";

export class ToolManager {
    private cache: Map<string, LoadedTool> = new Map();

    constructor() {}

    async createTool(
        name: string, 
        code_path: string, 
        auto_install: boolean, 
        json_llm: string
    ) {
        await ToolRegister(name, code_path, auto_install, json_llm);
        console.log(`Tool "${name}" registered`);
    }

    async getTool(name: string, forceReload = false): Promise<LoadedTool> {
        if (!forceReload && this.cache.has(name)) {
            console.log(`Using cached tool: ${name}`);
            return this.cache.get(name)!;
        }

        const tool = await ToolLoader(name);
        this.cache.set(name, tool);
        return tool;
    }

    async listTools(): Promise<string[]> {
        return await ToolList();
    }

    async loadAll(): Promise<Map<string, LoadedTool>> {
        const toolNames = await this.listTools();
        
        await Promise.all(
            toolNames.map(name => this.getTool(name))
        );

        console.log(`All tools loaded: ${this.cache.size} total`);
        return this.cache;
    }

    // Executes a tool by name (quick access)
    async executeTool(name: string, ...args: any[]): Promise<any> {
        const tool = await this.getTool(name);
        return await tool.execute(...args);
    }

    // Get metadata from a tool by name (quick access)
    async getMetadataTool(name: string) {
        const tool = await this.getTool(name);
        return tool.metadata;
    }

    clearCache(): void {
        this.cache.clear();
        console.log('Tool cache cleared');
    }

    removeFromCache(name: string): boolean {
        const removed = this.cache.delete(name);
        if (removed) {
            console.log(`Tool "${name}" removed from cache`);
        }
        return removed;
    }
}