import path from "node:path";
import { fileURLToPath } from "node:url";

const currentFile = fileURLToPath(import.meta.url);
const currentDir = path.dirname(currentFile);
const workspaceRoot = path.resolve(currentDir, "..", "..");

export const paths = {
  workspaceRoot,
};

export function resolveWorkspacePath(...segments: string[]): string {
  return path.join(paths.workspaceRoot, ...segments);
}
