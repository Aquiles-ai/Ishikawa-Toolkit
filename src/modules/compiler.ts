import { build } from 'esbuild';

export async function ToolCompiler(toolPath: string) {
    try {
        await build({
            entryPoints: [toolPath + '/index.ts'],
            outfile: toolPath + '/index.js',
            platform: 'node',
            format: 'esm',
            target: 'node18',
            bundle: false
        });
    } catch (error) {
        console.error('X Error compiling tool:', error);
        throw error;
    }
} 