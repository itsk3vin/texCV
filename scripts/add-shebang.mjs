import { readFile, writeFile, chmod } from "node:fs/promises";

const target = new URL("../dist-server/server/cli.js", import.meta.url);
const contents = await readFile(target, "utf8");
if (!contents.startsWith("#!")) {
  await writeFile(target, `#!/usr/bin/env node\n${contents}`);
}
await chmod(target, 0o755);

// npm's bin target expects this stable top-level path.
const shim = new URL("../dist-server/cli.js", import.meta.url);
await writeFile(shim, '#!/usr/bin/env node\nimport "./server/cli.js";\n');
await chmod(shim, 0o755);
