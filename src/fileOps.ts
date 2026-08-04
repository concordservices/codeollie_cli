import fs from 'fs/promises';
import path from 'path';

export class FileOperations {
  private workDir: string;

  constructor(workDir: string = process.cwd()) {
    this.workDir = workDir;
  }

  async createFile(filePath: string, content: string): Promise<void> {
    try {
      const fullPath = path.join(this.workDir, filePath);
      const dir = path.dirname(fullPath);

      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(fullPath, content, 'utf-8');
      console.log(`\x1b[32m✅ Created: ${filePath}\x1b[0m`);
    } catch (error) {
      console.error(`\x1b[31m❌ Failed to create file: ${error instanceof Error ? error.message : 'Unknown error'}\x1b[0m`);
      throw error;
    }
  }

  async editFile(filePath: string, content: string): Promise<void> {
    try {
      const fullPath = path.join(this.workDir, filePath);
      const dir = path.dirname(fullPath);

      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(fullPath, content, 'utf-8');
      console.log(`\x1b[32m✏️  Updated: ${filePath}\x1b[0m`);
    } catch (error) {
      console.error(`\x1b[31m❌ Failed to update file: ${error instanceof Error ? error.message : 'Unknown error'}\x1b[0m`);
      throw error;
    }
  }

  async readFile(filePath: string): Promise<string> {
    try {
      const fullPath = path.join(this.workDir, filePath);
      return await fs.readFile(fullPath, 'utf-8');
    } catch (error) {
      console.error(`\x1b[31m❌ Failed to read file: ${error instanceof Error ? error.message : 'Unknown error'}\x1b[0m`);
      throw error;
    }
  }

  async listFiles(dir: string = ''): Promise<string[]> {
    try {
      const fullPath = path.join(this.workDir, dir);
      const files = await fs.readdir(fullPath, { recursive: true });
      return files.filter((f) => typeof f === 'string').map((f) => path.join(dir, f));
    } catch (error) {
      console.error(`\x1b[31m❌ Failed to list files: ${error instanceof Error ? error.message : 'Unknown error'}\x1b[0m`);
      throw error;
    }
  }
}
