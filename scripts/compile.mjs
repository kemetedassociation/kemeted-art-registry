// Compile le contrat avec solc-js → contracts/build/KemetedArtRegistry.json (ABI + bytecode)
import solc from "solc";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

const source = readFileSync(new URL("../contracts/KemetedArtRegistry.sol", import.meta.url), "utf8");
const input = {
  language: "Solidity",
  sources: { "KemetedArtRegistry.sol": { content: source } },
  settings: { optimizer: { enabled: true, runs: 200 }, evmVersion: "cancun", outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } } },
};
const findImports = (path) => {
  try { return { contents: readFileSync(require.resolve(path), "utf8") }; }
  catch { return { error: "introuvable : " + path }; }
};
const out = JSON.parse(solc.compile(JSON.stringify(input), { import: findImports }));
const errors = (out.errors || []).filter((e) => e.severity === "error");
for (const e of out.errors || []) console.error(e.formattedMessage);
if (errors.length) process.exit(1);
const c = out.contracts["KemetedArtRegistry.sol"].KemetedArtRegistry;
mkdirSync(new URL("../contracts/build/", import.meta.url), { recursive: true });
writeFileSync(new URL("../contracts/build/KemetedArtRegistry.json", import.meta.url),
  JSON.stringify({ abi: c.abi, bytecode: "0x" + c.evm.bytecode.object }, null, 2));
console.log("Compilé : contracts/build/KemetedArtRegistry.json (" + c.evm.bytecode.object.length / 2 + " octets)");
