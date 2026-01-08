import { build } from 'esbuild';
import { mkdir } from 'fs/promises';
import { join } from 'path';


export async function ToolCompiler(toolPath: string) {
    try {

        const distPath = join(toolPath, 'dist');
        await mkdir(distPath, { recursive: true });

        await build({
            entryPoints: [toolPath + '/index.ts'],
            outfile: join(toolPath, 'dist', 'index.js'),
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