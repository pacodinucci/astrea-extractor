import { config } from "dotenv";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const currentDir = dirname(fileURLToPath(import.meta.url));
const candidateEnvPaths = [
  resolve(process.cwd(), ".env"),
  resolve(process.cwd(), "..", "..", ".env"),
  resolve(currentDir, "..", "..", "..", ".env"),
];

for (const envPath of candidateEnvPaths) {
  if (existsSync(envPath)) {
    config({ path: envPath, override: false });
  }
}