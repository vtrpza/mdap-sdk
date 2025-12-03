/**
 * Data Generation Script for Sequential Refactoring Case Study
 *
 * Generates:
 * - legacy-codebase.ts: Starting file with 500 issues
 * - legacy-codebase.golden.ts: Fully fixed ground truth
 * - issues.json: Manifest of all 500 issues with before/after
 *
 * Run with: npx tsx examples/sequential-refactor/src/generate-data.ts
 */

import * as fs from "fs";
import * as path from "path";

export interface Issue {
  id: number;
  line: number;
  category: "BUG" | "SECURITY" | "TYPE_SAFETY" | "ERROR_HANDLING" | "TRICKY";
  difficulty: "easy" | "medium" | "hard";
  description: string;
  before: string;
  after: string;
}

// Issue templates organized by category
// Each template generates multiple instances

const issueTemplates = {
  // ============================================================
  // BUG (100 issues) - Logic errors, null checks, off-by-one
  // ============================================================
  BUG: [
    // Null/undefined checks (20)
    ...Array.from({ length: 20 }, (_, i) => ({
      difficulty: "easy" as const,
      description: `Add null check before accessing property`,
      genBefore: (n: number) => `return data${n}.value;`,
      genAfter: (n: number) => `return data${n}?.value ?? null;`,
    })),
    // == vs === (20)
    ...Array.from({ length: 20 }, (_, i) => ({
      difficulty: "easy" as const,
      description: `Use strict equality instead of loose equality`,
      genBefore: (n: number) => `if (id${n} == target${n})`,
      genAfter: (n: number) => `if (id${n} === target${n})`,
    })),
    // Off-by-one in loops (15)
    ...Array.from({ length: 15 }, (_, i) => ({
      difficulty: "medium" as const,
      description: `Fix off-by-one error in loop condition`,
      genBefore: (n: number) => `for (let i = 0; i <= items${n}.length; i++)`,
      genAfter: (n: number) => `for (let i = 0; i < items${n}.length; i++)`,
    })),
    // Uninitialized variables (15)
    ...Array.from({ length: 15 }, (_, i) => ({
      difficulty: "medium" as const,
      description: `Initialize variable before use`,
      genBefore: (n: number) => `let total${n};`,
      genAfter: (n: number) => `let total${n} = 0;`,
    })),
    // Missing return in filter (10)
    ...Array.from({ length: 10 }, (_, i) => ({
      difficulty: "medium" as const,
      description: `Add missing return statement in callback`,
      genBefore: (n: number) => `arr${n}.filter(x => { x > 0; })`,
      genAfter: (n: number) => `arr${n}.filter(x => { return x > 0; })`,
    })),
    // Assignment instead of comparison (10)
    ...Array.from({ length: 10 }, (_, i) => ({
      difficulty: "easy" as const,
      description: `Fix assignment used as comparison`,
      genBefore: (n: number) => `if (status${n} = 'active')`,
      genAfter: (n: number) => `if (status${n} === 'active')`,
    })),
    // Typo in operator (10)
    ...Array.from({ length: 10 }, (_, i) => ({
      difficulty: "easy" as const,
      description: `Fix operator typo`,
      genBefore: (n: number) => `sum${n} =+ value${n};`,
      genAfter: (n: number) => `sum${n} += value${n};`,
    })),
  ],

  // ============================================================
  // SECURITY (100 issues) - Injection, XSS, secrets
  // ============================================================
  SECURITY: [
    // SQL injection (25)
    ...Array.from({ length: 25 }, (_, i) => ({
      difficulty: "medium" as const,
      description: `Use parameterized query to prevent SQL injection`,
      genBefore: (n: number) =>
        `db.query("SELECT * FROM table${n} WHERE id = " + userId${n})`,
      genAfter: (n: number) =>
        `db.query("SELECT * FROM table${n} WHERE id = ?", [userId${n}])`,
    })),
    // XSS prevention (25)
    ...Array.from({ length: 25 }, (_, i) => ({
      difficulty: "medium" as const,
      description: `Sanitize user input to prevent XSS`,
      genBefore: (n: number) => `element${n}.innerHTML = userInput${n};`,
      genAfter: (n: number) => `element${n}.textContent = userInput${n};`,
    })),
    // Hardcoded secrets (20)
    ...Array.from({ length: 20 }, (_, i) => ({
      difficulty: "easy" as const,
      description: `Move hardcoded secret to environment variable`,
      genBefore: (n: number) => `const apiKey${n} = 'sk-secret${n}abc123';`,
      genAfter: (n: number) =>
        `const apiKey${n} = process.env.API_KEY_${n} ?? '';`,
    })),
    // Path traversal (15)
    ...Array.from({ length: 15 }, (_, i) => ({
      difficulty: "medium" as const,
      description: `Validate path to prevent directory traversal`,
      genBefore: (n: number) => `fs.readFile('./uploads/' + filename${n})`,
      genAfter: (n: number) =>
        `fs.readFile(path.join('./uploads', path.basename(filename${n})))`,
    })),
    // Eval usage (15)
    ...Array.from({ length: 15 }, (_, i) => ({
      difficulty: "hard" as const,
      description: `Replace eval with safe alternative`,
      genBefore: (n: number) => `eval(expression${n})`,
      genAfter: (n: number) => `JSON.parse(expression${n})`,
    })),
  ],

  // ============================================================
  // TYPE_SAFETY (100 issues) - Missing types, radix, coercion
  // ============================================================
  TYPE_SAFETY: [
    // parseInt radix (25)
    ...Array.from({ length: 25 }, (_, i) => ({
      difficulty: "easy" as const,
      description: `Add radix parameter to parseInt`,
      genBefore: (n: number) => `parseInt(str${n})`,
      genAfter: (n: number) => `parseInt(str${n}, 10)`,
    })),
    // Type annotations for parameters (25)
    ...Array.from({ length: 25 }, (_, i) => ({
      difficulty: "easy" as const,
      description: `Add type annotation to parameter`,
      genBefore: (n: number) => `function process${n}(data)`,
      genAfter: (n: number) => `function process${n}(data: unknown)`,
    })),
    // Type annotations for return (25)
    ...Array.from({ length: 25 }, (_, i) => ({
      difficulty: "easy" as const,
      description: `Add return type annotation`,
      genBefore: (n: number) => `function getValue${n}()`,
      genAfter: (n: number) => `function getValue${n}(): string | null`,
    })),
    // Explicit any to unknown (25)
    ...Array.from({ length: 25 }, (_, i) => ({
      difficulty: "easy" as const,
      description: `Replace any with unknown for type safety`,
      genBefore: (n: number) => `let result${n}: any`,
      genAfter: (n: number) => `let result${n}: unknown`,
    })),
  ],

  // ============================================================
  // ERROR_HANDLING (100 issues) - Try/catch, response checks
  // ============================================================
  ERROR_HANDLING: [
    // Missing try/catch (30)
    ...Array.from({ length: 30 }, (_, i) => ({
      difficulty: "medium" as const,
      description: `Wrap in try/catch for error handling`,
      genBefore: (n: number) => `const data${n} = JSON.parse(input${n});`,
      genAfter: (n: number) =>
        `let data${n}; try { data${n} = JSON.parse(input${n}); } catch { data${n} = null; }`,
    })),
    // Missing response.ok check (30)
    ...Array.from({ length: 30 }, (_, i) => ({
      difficulty: "medium" as const,
      description: `Check response.ok before parsing`,
      genBefore: (n: number) => `return await response${n}.json();`,
      genAfter: (n: number) =>
        `if (!response${n}.ok) throw new Error('Request failed'); return await response${n}.json();`,
    })),
    // Missing null coalescing (20)
    ...Array.from({ length: 20 }, (_, i) => ({
      difficulty: "easy" as const,
      description: `Add fallback for undefined value`,
      genBefore: (n: number) => `const val${n} = config${n}.setting;`,
      genAfter: (n: number) =>
        `const val${n} = config${n}.setting ?? 'default';`,
    })),
    // Promise rejection handling (20)
    ...Array.from({ length: 20 }, (_, i) => ({
      difficulty: "medium" as const,
      description: `Add catch handler for promise`,
      genBefore: (n: number) => `promise${n}.then(handle${n});`,
      genAfter: (n: number) =>
        `promise${n}.then(handle${n}).catch(err => console.error(err));`,
    })),
  ],

  // ============================================================
  // TRICKY (100 issues) - Subtle bugs that require careful attention
  // ============================================================
  TRICKY: [
    // Async forEach (20)
    ...Array.from({ length: 20 }, (_, i) => ({
      difficulty: "hard" as const,
      description: `Fix async forEach - use for...of instead`,
      genBefore: (n: number) =>
        `items${n}.forEach(async (item) => { await process(item); });`,
      genAfter: (n: number) =>
        `for (const item of items${n}) { await process(item); }`,
    })),
    // Closure in loop (15)
    ...Array.from({ length: 15 }, (_, i) => ({
      difficulty: "hard" as const,
      description: `Fix closure capturing loop variable`,
      genBefore: (n: number) =>
        `for (var i${n} = 0; i${n} < 3; i${n}++) { setTimeout(() => log(i${n}), 100); }`,
      genAfter: (n: number) =>
        `for (let i${n} = 0; i${n} < 3; i${n}++) { setTimeout(() => log(i${n}), 100); }`,
    })),
    // Missing await (20)
    ...Array.from({ length: 20 }, (_, i) => ({
      difficulty: "hard" as const,
      description: `Add missing await for async function`,
      genBefore: (n: number) => `const result${n} = asyncFetch${n}();`,
      genAfter: (n: number) => `const result${n} = await asyncFetch${n}();`,
    })),
    // Spread vs reference (15)
    ...Array.from({ length: 15 }, (_, i) => ({
      difficulty: "hard" as const,
      description: `Clone object instead of referencing`,
      genBefore: (n: number) => `const copy${n} = original${n};`,
      genAfter: (n: number) => `const copy${n} = { ...original${n} };`,
    })),
    // Array mutation (15)
    ...Array.from({ length: 15 }, (_, i) => ({
      difficulty: "hard" as const,
      description: `Return new array instead of mutating`,
      genBefore: (n: number) => `arr${n}.push(item${n}); return arr${n};`,
      genAfter: (n: number) => `return [...arr${n}, item${n}];`,
    })),
    // Floating point comparison (15)
    ...Array.from({ length: 15 }, (_, i) => ({
      difficulty: "hard" as const,
      description: `Use epsilon comparison for floating point`,
      genBefore: (n: number) => `if (float${n} === 0.1 + 0.2)`,
      genAfter: (n: number) =>
        `if (Math.abs(float${n} - 0.3) < Number.EPSILON)`,
    })),
  ],
};

function generateCodebase(): {
  buggyCode: string;
  goldenCode: string;
  issues: Issue[];
} {
  const issues: Issue[] = [];
  const buggyLines: string[] = [];
  const goldenLines: string[] = [];

  let issueId = 1;
  let lineNumber = 1;

  // Header
  const header = `/**
 * Legacy API Service
 * 
 * This file contains 500 issues that need to be fixed sequentially.
 * Used for MDAP sequential refactoring case study.
 * 
 * DO NOT EDIT MANUALLY - Generated by generate-data.ts
 */

import * as fs from 'fs';
import * as path from 'path';

// Database mock
const db = { query: (q: string, params?: unknown[]) => Promise.resolve([]) };

// Utility functions
function log(msg: unknown) { console.log(msg); }
function process(item: unknown) { return Promise.resolve(item); }
function handle(data: unknown) { return data; }
function asyncFetch(url: string) { return Promise.resolve({}); }

`;
  buggyLines.push(header);
  goldenLines.push(header);
  lineNumber += header.split("\n").length;

  // Generate sections
  const categories = Object.keys(issueTemplates) as Array<
    keyof typeof issueTemplates
  >;

  for (const category of categories) {
    const templates = issueTemplates[category];
    const sectionHeader = `\n// ${"=".repeat(60)}\n// Section: ${category} (${templates.length} issues)\n// ${"=".repeat(60)}\n\n`;

    buggyLines.push(sectionHeader);
    goldenLines.push(sectionHeader);
    lineNumber += sectionHeader.split("\n").length;

    for (let i = 0; i < templates.length; i++) {
      const template = templates[i];
      const n = issueId; // Use issue ID for unique variable names

      const before = template.genBefore(n);
      const after = template.genAfter(n);

      // Create a function wrapper to make it valid code
      const buggyFunc = `function fix${issueId}() {\n  ${before}\n}\n\n`;
      const goldenFunc = `function fix${issueId}() {\n  ${after}\n}\n\n`;

      issues.push({
        id: issueId,
        line: lineNumber + 1, // The actual issue is on line 2 of the function
        category,
        difficulty: template.difficulty,
        description: template.description,
        before,
        after,
      });

      buggyLines.push(buggyFunc);
      goldenLines.push(goldenFunc);
      lineNumber += buggyFunc.split("\n").length;
      issueId++;
    }
  }

  // Footer
  const footer = `\n// End of legacy codebase - ${issues.length} issues total\nexport {};\n`;
  buggyLines.push(footer);
  goldenLines.push(footer);

  return {
    buggyCode: buggyLines.join(""),
    goldenCode: goldenLines.join(""),
    issues,
  };
}

function main() {
  console.log("🔧 Generating Sequential Refactoring Test Data\n");

  const { buggyCode, goldenCode, issues } = generateCodebase();

  // Verify we have 500 issues
  console.log(`Generated ${issues.length} issues`);
  if (issues.length !== 500) {
    console.error(`❌ Expected 500 issues, got ${issues.length}`);
    process.exit(1);
  }

  // Count by category
  const byCategory = issues.reduce(
    (acc, issue) => {
      acc[issue.category] = (acc[issue.category] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );
  console.log("By category:", byCategory);

  // Count by difficulty
  const byDifficulty = issues.reduce(
    (acc, issue) => {
      acc[issue.difficulty] = (acc[issue.difficulty] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );
  console.log("By difficulty:", byDifficulty);

  // Write files
  const dataDir = path.join(import.meta.dirname ?? ".", "..", "data");
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const buggyPath = path.join(dataDir, "legacy-codebase.ts");
  const goldenPath = path.join(dataDir, "legacy-codebase.golden.ts");
  const issuesPath = path.join(dataDir, "issues.json");

  fs.writeFileSync(buggyPath, buggyCode);
  console.log(`\n✅ Written: ${buggyPath} (${buggyCode.length} chars)`);

  fs.writeFileSync(goldenPath, goldenCode);
  console.log(`✅ Written: ${goldenPath} (${goldenCode.length} chars)`);

  fs.writeFileSync(issuesPath, JSON.stringify({ issues }, null, 2));
  console.log(`✅ Written: ${issuesPath} (${issues.length} issues)`);

  // Stats
  console.log(`\n📊 Stats:`);
  console.log(`  - Buggy code: ${buggyCode.split("\n").length} lines`);
  console.log(`  - Golden code: ${goldenCode.split("\n").length} lines`);
  console.log(`  - Estimated tokens: ~${Math.round(buggyCode.length / 4)}`);
}

main();
