import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { UX_RULES } from "@/lib/knowledge";
import { renderKnowledgeDoc } from "@/lib/ux/knowledge-doc";
import { renderRule } from "@/lib/ux/rules/dsl";

describe("UX decision DSL (PRD §30)", () => {
  it("renders a rule as WHEN / RECOMMEND / AVOID / BECAUSE", () => {
    const rule = UX_RULES.find((r) => r.id === "tables.volume-high.table")!;
    expect(renderRule(rule)).toBe(
      [
        "RULE tables.volume-high.table   [DATA_VOLUME_HIGH · task · high]",
        "WHEN      Is the expected data volume high?  is true",
        "AND NOT   Are records primarily recognized visually?  is true",
        "RECOMMEND data-table   (Data presentation)",
        "AVOID     card-grid",
        "BECAUSE   Many text-and-number records are scanned fastest in rows and columns; cards fit far fewer records per screen.",
        "SOURCE    NN/g: Data Tables: Four Major User Tasks",
      ].join("\n")
    );
  });

  it("calls a critical avoid what it is: a veto", () => {
    const rule = UX_RULES.find((r) => r.code === "DESTRUCTIVE_PROTECTED")!;
    expect(renderRule(rule)).toContain("RULE OUT  none");
  });
});

describe("docs/KNOWLEDGE.md", () => {
  it("is up to date with knowledge/ (run `npm run knowledge:doc` if this fails)", () => {
    const file = fs.readFileSync(path.join(import.meta.dirname, "..", "..", "docs", "KNOWLEDGE.md"), "utf8");
    expect(file.replace(/\r\n/g, "\n")).toBe(renderKnowledgeDoc());
  });
});
