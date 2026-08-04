import fs from 'fs/promises';
import path from 'path';

export class FileOperations {
  private workDir: string;

  constructor(workDir: string = process.cwd()) {
    this.workDir = workDir;
  }

  private resolvePath(filePath: string) {
    return path.isAbsolute(filePath) ? filePath : path.join(this.workDir, filePath);
  }

  async createFile(filePath: string, content: string): Promise<void> {
    try {
      let fullPath = this.resolvePath(filePath);

      // If target is an existing directory, treat as directory and create an untitled file inside it.
      try {
        const stat = await fs.stat(fullPath);
        if (stat.isDirectory()) {
          // default filename when user provided a directory
          fullPath = path.join(fullPath, 'untitled.txt');
        }
      } catch (e) {
        // stat failed -> path may not exist yet; continue normally
      }

      const dir = path.dirname(fullPath);

      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(fullPath, content, 'utf-8');
      console.log(`\x1b[32m✅ Created: ${fullPath}\x1b[0m`);
    } catch (error) {
      console.error(`\x1b[31m❌ Failed to create file: ${error instanceof Error ? error.message : 'Unknown error'}\x1b[0m`);
      throw error;
    }
  }

  async editFile(filePath: string, content: string): Promise<void> {
    try {
      const fullPath = this.resolvePath(filePath);
      const dir = path.dirname(fullPath);

      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(fullPath, content, 'utf-8');
      console.log(`\x1b[32m✏️  Updated: ${fullPath}\x1b[0m`);
    } catch (error) {
      console.error(`\x1b[31m❌ Failed to update file: ${error instanceof Error ? error.message : 'Unknown error'}\x1b[0m`);
      throw error;
    }
  }

  async readFile(filePath: string): Promise<string> {
    try {
      const fullPath = this.resolvePath(filePath);
      return await fs.readFile(fullPath, 'utf-8');
    } catch (error) {
      console.error(`\x1b[31m❌ Failed to read file: ${error instanceof Error ? error.message : 'Unknown error'}\x1b[0m`);
      throw error;
    }
  }

  async listFiles(dir: string = ''): Promise<string[]> {
    try {
      const startPath = this.resolvePath(dir || '.');
      const results: string[] = [];

      async function walk(currentPath: string, base: string) {
        const entries = await fs.readdir(currentPath, { withFileTypes: true });
        for (const entry of entries) {
          const full = path.join(currentPath, entry.name);
          const rel = path.join(base, entry.name);
          if (entry.isDirectory()) {
            await walk(full, rel);
          } else if (entry.isFile()) {
            results.push(rel);
          }
        }
      }

      await walk(startPath, '');
      return results;
    } catch (error) {
      console.error(`\x1b[31m❌ Failed to list files: ${error instanceof Error ? error.message : 'Unknown error'}\x1b[0m`);
      throw error;
    }
  }
}
