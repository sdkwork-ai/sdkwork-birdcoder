import fs from "node:fs";
import path from "node:path";

const [archive, command = "list", argument = "", extra = ""] = process.argv.slice(2);
if (!archive) throw new Error("usage: node .tmp-asar-inspect.mjs <archive> <command> [argument]");

const fd = fs.openSync(archive, "r");
const prefix = Buffer.alloc(16);
fs.readSync(fd, prefix, 0, prefix.length, 0);
const headerSize = prefix.readUInt32LE(4);
const jsonSize = prefix.readUInt32LE(12);
const json = Buffer.alloc(jsonSize);
fs.readSync(fd, json, 0, json.length, 16);
const header = JSON.parse(json.toString("utf8"));
const dataOffset = 8 + headerSize;

function walk(node, parent = "") {
  const out = [];
  for (const [name, value] of Object.entries(node.files ?? {})) {
    const file = parent ? `${parent}/${name}` : name;
    if (value.files) out.push(...walk(value, file));
    else out.push({ file, ...value });
  }
  return out;
}

const entries = walk(header);
const match = (value) => new RegExp(argument, "i").test(value);
function read(entry) {
  if (entry.unpacked) {
    return fs.readFileSync(path.join(`${archive}.unpacked`, ...entry.file.split("/")));
  }
  const data = Buffer.alloc(entry.size);
  fs.readSync(fd, data, 0, data.length, dataOffset + Number(entry.offset));
  return data;
}

if (command === "info") {
  console.log(JSON.stringify({ headerSize, jsonSize, dataOffset, entries: entries.length }, null, 2));
} else if (command === "list") {
  for (const entry of entries.filter((item) => !argument || match(item.file))) {
    console.log(`${entry.size}\t${entry.offset ?? "unpacked"}\t${entry.file}`);
  }
} else if (command === "get") {
  const entry = entries.find((item) => item.file === argument);
  if (!entry) throw new Error(`entry not found: ${argument}`);
  process.stdout.write(read(entry));
} else if (command === "grep") {
  const regex = new RegExp(argument, "ig");
  for (const entry of entries.filter(({ file, size }) => /\.(?:js|mjs|cjs|json|html|css|map|txt)$/i.test(file) && size < 30_000_000)) {
    const text = read(entry).toString("utf8");
    const matches = [...text.matchAll(regex)];
    if (!matches.length) continue;
    const snippets = matches.slice(0, 8).map(({ index = 0 }) => text.slice(Math.max(0, index - 100), Math.min(text.length, index + 220)).replace(/[\r\n\t]+/g, " "));
    console.log(`FILE\t${entry.file}\tMATCHES\t${matches.length}`);
    for (const snippet of snippets) console.log(`  ${snippet}`);
  }
} else if (command === "stats") {
  const stats = new Map();
  for (const entry of entries) {
    const ext = path.extname(entry.file).toLowerCase() || "<none>";
    const previous = stats.get(ext) ?? { count: 0, bytes: 0 };
    previous.count += 1;
    previous.bytes += entry.size;
    stats.set(ext, previous);
  }
  for (const [ext, value] of [...stats].sort((a, b) => b[1].bytes - a[1].bytes)) console.log(ext, value);
} else if (command === "extract-matching") {
  if (!extra) throw new Error("extract-matching requires a destination directory");
  for (const entry of entries.filter((item) => match(item.file))) {
    const destination = path.join(extra, ...entry.file.split("/"));
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, read(entry));
    console.log(destination);
  }
} else {
  throw new Error(`unknown command: ${command}`);
}

fs.closeSync(fd);
