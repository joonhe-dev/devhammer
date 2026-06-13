import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

export async function readFileContent(filePath: string): Promise<string> {
  return readFile(filePath, 'utf-8');
}

export async function writeFileContent(filePath: string, content: string): Promise<void> {
  const dir = dirname(filePath);
  await ensureDir(dir);
  await writeFile(filePath, content, 'utf-8');
}

export async function ensureDir(dirPath: string): Promise<void> {
  if (!existsSync(dirPath)) {
    await mkdir(dirPath, { recursive: true });
  }
}

export function fileExists(filePath: string): boolean {
  return existsSync(filePath);
}

export async function readJson<T = unknown>(filePath: string): Promise<T> {
  const content = await readFileContent(filePath);
  return JSON.parse(content) as T;
}

export async function writeJson(filePath: string, data: unknown, pretty: boolean = true): Promise<void> {
  const content = pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data);
  await writeFileContent(filePath, content);
}

export function resolvePath(...segments: string[]): string {
  return join(...segments);
}
