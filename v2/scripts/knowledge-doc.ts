import fs from "node:fs";
import path from "node:path";
import { renderKnowledgeDoc } from "@/lib/ux/knowledge-doc";

const target = path.join(import.meta.dirname, "..", "docs", "KNOWLEDGE.md");
fs.writeFileSync(target, renderKnowledgeDoc());
console.log(`Wrote ${path.relative(process.cwd(), target)}`);
