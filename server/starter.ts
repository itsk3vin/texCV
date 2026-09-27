import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));
const templatePath = [
  path.resolve(moduleDirectory, "../../.texcv-template.tex"),
  path.resolve(moduleDirectory, "../.texcv-template.tex"),
].find(existsSync);

if (!templatePath) throw new Error("The bundled TexCV starter template is missing.");

export const STARTER = readFileSync(templatePath, "utf8");
