/**
 * Agentic Minesweeper Builder - Optimized Version
 *
 * Optimizations:
 * 1. Parallel MDAP sampling - fire all samples at once
 * 2. Batched steps - 3-4 related changes per API call
 * 3. Designed for parallel trial execution
 */

import OpenAI from "openai";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
export interface AgentConfig {
  model: string;
  useMdap: boolean;
  k: number; // vote threshold for MDAP
  temperature: number;
  maxSteps: number;
  outputDir: string;
  trialId: string;
}

// Step result
export interface StepResult {
  step: number;
  action: string;
  code: string;
  samples: number;
  inputTokens: number;
  outputTokens: number;
  timeMs: number;
  error?: string;
}

// Trial result
export interface TrialResult {
  config: AgentConfig;
  steps: StepResult[];
  finalCode: string;
  totalSteps: number;
  completed: boolean;
  totalTimeMs: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  estimatedCost: number;
}

const SPEC = fs.readFileSync(path.join(__dirname, "spec.md"), "utf-8");

const SYSTEM_PROMPT = `You are an expert frontend developer building a Minesweeper game step by step.

You will receive:
1. The current code state
2. The specification
3. Instructions for the next changes to make

Your task is to output ONLY the complete updated code after making ALL the requested changes.

Rules:
- Make ALL the requested changes in one go
- Output the COMPLETE HTML file (not a diff)
- Do not add explanations, just the code
- The code must be valid HTML that can run in a browser
- Wrap your output in \`\`\`html and \`\`\` tags`;

const INITIAL_CODE = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Minesweeper</title>
  <style>
  </style>
</head>
<body>
  <script>
  </script>
</body>
</html>`;

// BATCHED steps - 3-4 related changes per batch
// This reduces API calls from 120 to ~35
const BATCHED_STEPS = [
  // Batch 1: CSS Reset & Body (4 items)
  `Add these CSS styles:
1. CSS reset: * { margin: 0; padding: 0; box-sizing: border-box; }
2. Body styles: display flex, justify-content center, align-items center, background #1a1a2e, min-height 100vh, font-family system-ui
3. .container: display flex, flex-direction column, align-items center, padding 20px
4. .header: text-align center, margin-bottom 20px, color white`,

  // Batch 2: Header & Stats CSS (4 items)
  `Add these CSS styles:
1. h1: font-size 2.5rem, margin-bottom 10px, text-shadow 0 0 10px cyan for glow
2. .stats: display flex, gap 30px, font-size 1.2rem
3. .stat: display flex, align-items center, gap 8px
4. .stat-value: font-weight bold, min-width 40px`,

  // Batch 3: Grid CSS (4 items)
  `Add these CSS styles:
1. .grid: display grid, grid-template-columns repeat(16, 1fr), gap 2px, background #0f0f1a, padding 10px, border-radius 8px, box-shadow 0 0 20px rgba(0,255,255,0.1)
2. .cell: width 28px, height 28px, display flex, align-items center, justify-content center, font-weight bold, cursor pointer, border-radius 4px, transition all 0.15s
3. .cell.hidden: background linear-gradient(145deg, #3a3a5c, #2a2a4c)
4. .cell.hidden:hover: background #4a4a6c, transform scale(1.05)`,

  // Batch 4: Cell State CSS (4 items)
  `Add these CSS styles:
1. .cell.revealed: background #1a1a2e
2. .cell.flagged: background #4a3a5c
3. .cell.mine: background #ff4757, color white
4. Number colors: .n1 { color: #3498db; } .n2 { color: #2ecc71; } .n3 { color: #e74c3c; } .n4 { color: #9b59b6; } .n5 { color: #e67e22; } .n6 { color: #1abc9c; } .n7 { color: #34495e; } .n8 { color: #7f8c8d; }`,

  // Batch 5: Controls & Button CSS (4 items)
  `Add these CSS styles:
1. .controls: margin-top 20px, display flex, gap 15px
2. button: padding 12px 24px, font-size 1rem, border none, border-radius 6px, cursor pointer, background #4a4a7c, color white, transition all 0.2s
3. button:hover: background #5a5a9c, transform translateY(-2px)
4. #message: position fixed, top 50%, left 50%, transform translate(-50%, -50%), padding 30px 50px, border-radius 12px, font-size 2rem, font-weight bold, z-index 100, display none`,

  // Batch 6: Message & Animation CSS (4 items)
  `Add these CSS styles:
1. #message.show: display block, animation fadeIn 0.3s
2. #message.win: background #2ed573, color white
3. #message.lose: background #ff4757, color white
4. @keyframes fadeIn { from { opacity: 0; transform: translate(-50%, -50%) scale(0.8); } to { opacity: 1; transform: translate(-50%, -50%) scale(1); } }`,

  // Batch 7: Game Constants & State (all JS variables)
  `Add these JavaScript variables at the start of the script:
const GRID_SIZE = 16;
const MINE_COUNT = 40;
let grid = [];
let revealed = new Set();
let flagged = new Set();
let gameOver = false;
let gameWon = false;
let minesRemaining = MINE_COUNT;
let timerInterval = null;
let secondsElapsed = 0;
let firstClick = true;`,

  // Batch 8: HTML Structure (all HTML elements)
  `Add this HTML structure inside body (before script):
<div class="container">
  <div class="header">
    <h1>Minesweeper</h1>
    <div class="stats">
      <div class="stat"><span class="stat-icon">💣</span><span id="mine-count" class="stat-value">40</span></div>
      <div class="stat"><span class="stat-icon">⏱️</span><span id="timer" class="stat-value">00:00</span></div>
    </div>
  </div>
  <div id="grid" class="grid"></div>
  <div class="controls">
    <button id="new-game">New Game</button>
  </div>
  <div id="message"></div>
</div>`,

  // Batch 9: Utility Functions (helper functions)
  `Add these JavaScript utility functions:
function getNeighbors(row, col) {
  const neighbors = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const nr = row + dr, nc = col + dc;
      if (nr >= 0 && nr < GRID_SIZE && nc >= 0 && nc < GRID_SIZE) {
        neighbors.push([nr, nc]);
      }
    }
  }
  return neighbors;
}

function getCell(row, col) {
  return document.querySelector(\`.cell[data-row="\${row}"][data-col="\${col}"]\`);
}

function updateMineCount() {
  document.getElementById('mine-count').textContent = minesRemaining;
}

function formatTime(secs) {
  const m = Math.floor(secs / 60).toString().padStart(2, '0');
  const s = (secs % 60).toString().padStart(2, '0');
  return m + ':' + s;
}

function updateTimer() {
  document.getElementById('timer').textContent = formatTime(secondsElapsed);
}

function startTimer() {
  if (timerInterval) return;
  timerInterval = setInterval(() => { secondsElapsed++; updateTimer(); }, 1000);
}

function stopTimer() {
  if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
}`,

  // Batch 10: Grid Creation Functions
  `Add these JavaScript functions for grid creation:
function createGrid() {
  grid = [];
  for (let r = 0; r < GRID_SIZE; r++) {
    grid[r] = [];
    for (let c = 0; c < GRID_SIZE; c++) {
      grid[r][c] = 0;
    }
  }
}

function placeMines(excludeRow, excludeCol) {
  let placed = 0;
  while (placed < MINE_COUNT) {
    const r = Math.floor(Math.random() * GRID_SIZE);
    const c = Math.floor(Math.random() * GRID_SIZE);
    if (grid[r][c] !== -1 && !(r === excludeRow && c === excludeCol)) {
      grid[r][c] = -1;
      placed++;
    }
  }
}

function calculateNumbers() {
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      if (grid[r][c] === -1) continue;
      let count = 0;
      for (const [nr, nc] of getNeighbors(r, c)) {
        if (grid[nr][nc] === -1) count++;
      }
      grid[r][c] = count;
    }
  }
}`,

  // Batch 11: Render Grid Function
  `Add the renderGrid function:
function renderGrid() {
  const gridEl = document.getElementById('grid');
  gridEl.innerHTML = '';
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      const cell = document.createElement('div');
      cell.className = 'cell hidden';
      cell.dataset.row = r;
      cell.dataset.col = c;
      cell.addEventListener('click', () => handleClick(r, c));
      cell.addEventListener('contextmenu', (e) => handleRightClick(r, c, e));
      gridEl.appendChild(cell);
    }
  }
}`,

  // Batch 12: Click Handlers
  `Add the click handler functions:
function handleClick(row, col) {
  if (gameOver) return;
  const key = row + ',' + col;
  if (flagged.has(key) || revealed.has(key)) return;
  
  if (firstClick) {
    firstClick = false;
    placeMines(row, col);
    calculateNumbers();
    startTimer();
  }
  
  if (grid[row][col] === -1) {
    revealMine(row, col);
    endGame(false);
    return;
  }
  
  revealCell(row, col);
  checkWin();
}

function handleRightClick(row, col, e) {
  e.preventDefault();
  if (gameOver) return;
  const key = row + ',' + col;
  if (revealed.has(key)) return;
  
  const cell = getCell(row, col);
  if (flagged.has(key)) {
    flagged.delete(key);
    cell.textContent = '';
    cell.classList.remove('flagged');
    minesRemaining++;
  } else {
    flagged.add(key);
    cell.textContent = '🚩';
    cell.classList.add('flagged');
    minesRemaining--;
  }
  updateMineCount();
}`,

  // Batch 13: Reveal Functions
  `Add the reveal functions:
function revealCell(row, col) {
  const key = row + ',' + col;
  if (revealed.has(key) || flagged.has(key)) return;
  
  revealed.add(key);
  const cell = getCell(row, col);
  cell.classList.remove('hidden');
  cell.classList.add('revealed');
  
  const count = grid[row][col];
  if (count > 0) {
    cell.textContent = count;
    cell.classList.add('n' + count);
  } else if (count === 0) {
    for (const [nr, nc] of getNeighbors(row, col)) {
      revealCell(nr, nc);
    }
  }
}

function revealMine(row, col) {
  const cell = getCell(row, col);
  cell.classList.remove('hidden');
  cell.classList.add('mine');
  cell.textContent = '💥';
}

function revealAllMines() {
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      if (grid[r][c] === -1) {
        const cell = getCell(r, c);
        cell.classList.remove('hidden', 'flagged');
        cell.classList.add('mine');
        cell.textContent = '💣';
      }
    }
  }
}`,

  // Batch 14: Game End & Win Check
  `Add the game end functions:
function endGame(won) {
  gameOver = true;
  gameWon = won;
  stopTimer();
  
  const msg = document.getElementById('message');
  if (won) {
    msg.textContent = '🎉 You Win!';
    msg.className = 'show win';
  } else {
    revealAllMines();
    msg.textContent = '💥 Game Over!';
    msg.className = 'show lose';
  }
}

function checkWin() {
  const totalCells = GRID_SIZE * GRID_SIZE;
  const nonMineCells = totalCells - MINE_COUNT;
  if (revealed.size === nonMineCells) {
    endGame(true);
  }
}

function hideMessage() {
  document.getElementById('message').className = '';
}`,

  // Batch 15: Init & Reset
  `Add the init and reset functions, plus event listeners:
function initGame() {
  grid = [];
  revealed = new Set();
  flagged = new Set();
  gameOver = false;
  gameWon = false;
  minesRemaining = MINE_COUNT;
  secondsElapsed = 0;
  firstClick = true;
  stopTimer();
  updateTimer();
  updateMineCount();
  createGrid();
  renderGrid();
  hideMessage();
}

document.getElementById('new-game').addEventListener('click', initGame);
document.getElementById('message').addEventListener('click', hideMessage);
document.addEventListener('DOMContentLoaded', initGame);`,

  // Batch 16: Polish - Animations
  `Add these CSS animation styles:
1. @keyframes pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.1); } }
2. .cell.mine { animation: pulse 0.5s ease-in-out; }
3. .cell.revealed { animation: reveal 0.2s ease-out; }
4. @keyframes reveal { from { transform: scale(0.8); opacity: 0; } to { transform: scale(1); opacity: 1; } }`,

  // Batch 17: Polish - Visual Enhancements
  `Add these final CSS polish styles:
1. body: background linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)
2. .grid:hover: box-shadow 0 0 30px rgba(0,255,255,0.2)
3. .stat-value: text-shadow 0 0 5px rgba(255,255,255,0.3)
4. button:active: transform translateY(0)
5. .cell: user-select none; border: 1px solid rgba(255,255,255,0.05)`,
];

// Extract code from LLM response
function extractCode(response: string): string {
  const match = response.match(/```html\n?([\s\S]*?)```/);
  if (match) {
    return match[1].trim();
  }
  // If no code block, assume entire response is code
  return response.trim();
}

// Calculate cost based on model
function calculateCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const pricing: Record<string, { input: number; output: number }> = {
    "gpt-4.1-mini": { input: 0.0004, output: 0.0016 }, // per 1K tokens
    "gpt-4o": { input: 0.005, output: 0.015 }, // per 1K tokens
    "gpt-4o-mini": { input: 0.00015, output: 0.0006 }, // per 1K tokens
  };

  const p = pricing[model] || pricing["gpt-4.1-mini"];
  return (inputTokens / 1000) * p.input + (outputTokens / 1000) * p.output;
}

// Single LLM call (baseline)
async function callLLM(
  client: OpenAI,
  config: AgentConfig,
  currentCode: string,
  stepInstruction: string,
): Promise<{ code: string; inputTokens: number; outputTokens: number }> {
  const userPrompt = `## Current Code:\n\`\`\`html\n${currentCode}\n\`\`\`\n\n## Specification:\n${SPEC}\n\n## Next Changes:\n${stepInstruction}\n\nOutput the complete updated HTML file:`;

  const response = await client.chat.completions.create({
    model: config.model,
    temperature: config.temperature,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
  });

  const content = response.choices[0].message.content || "";
  const code = extractCode(content);

  return {
    code,
    inputTokens: response.usage?.prompt_tokens || 0,
    outputTokens: response.usage?.completion_tokens || 0,
  };
}

// PARALLEL MDAP voting - fire all initial samples at once
async function callLLMWithMDAP(
  client: OpenAI,
  config: AgentConfig,
  currentCode: string,
  stepInstruction: string,
): Promise<{
  code: string;
  inputTokens: number;
  outputTokens: number;
  samples: number;
}> {
  const userPrompt = `## Current Code:\n\`\`\`html\n${currentCode}\n\`\`\`\n\n## Specification:\n${SPEC}\n\n## Next Changes:\n${stepInstruction}\n\nOutput the complete updated HTML file:`;

  const messages: OpenAI.ChatCompletionMessageParam[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: userPrompt },
  ];

  const votes: Map<string, { count: number; code: string }> = new Map();
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let samples = 0;
  const maxSamples = 15;

  // Fire initial batch of k samples in parallel
  const initialBatchSize = config.k;

  while (samples < maxSamples) {
    // Determine how many samples to fire in parallel
    const batchSize = Math.min(
      samples === 0 ? initialBatchSize : 2, // First batch: k samples, then 2 at a time
      maxSamples - samples,
    );

    // Fire samples in parallel
    const promises = Array(batchSize)
      .fill(null)
      .map(() =>
        client.chat.completions.create({
          model: config.model,
          temperature: config.temperature,
          messages,
        }),
      );

    const responses = await Promise.all(promises);

    // Process responses
    for (const response of responses) {
      samples++;
      totalInputTokens += response.usage?.prompt_tokens || 0;
      totalOutputTokens += response.usage?.completion_tokens || 0;

      const content = response.choices[0].message.content || "";
      const code = extractCode(content);

      // Normalize for comparison
      const normalizedCode = code.replace(/\s+/g, " ").trim();

      const existing = votes.get(normalizedCode);
      if (existing) {
        existing.count++;
      } else {
        votes.set(normalizedCode, { count: 1, code });
      }
    }

    // Check if any option has k more votes than all others
    const sortedVotes = Array.from(votes.values()).sort(
      (a, b) => b.count - a.count,
    );

    if (sortedVotes.length > 0) {
      const leader = sortedVotes[0];
      const secondPlace = sortedVotes[1]?.count || 0;

      if (leader.count >= config.k + secondPlace) {
        return {
          code: leader.code,
          inputTokens: totalInputTokens,
          outputTokens: totalOutputTokens,
          samples,
        };
      }
    }
  }

  // Max samples reached, return most voted
  const sortedVotes = Array.from(votes.values()).sort(
    (a, b) => b.count - a.count,
  );

  return {
    code: sortedVotes[0]?.code || "",
    inputTokens: totalInputTokens,
    outputTokens: totalOutputTokens,
    samples,
  };
}

// Main agent loop
export async function runAgent(config: AgentConfig): Promise<TrialResult> {
  const client = new OpenAI();
  const steps: StepResult[] = [];
  let currentCode = INITIAL_CODE;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  const startTime = Date.now();

  const stepsToUse = BATCHED_STEPS;
  const stepsToRun = Math.min(config.maxSteps, stepsToUse.length);

  console.log(
    `\n🎮 Starting ${config.useMdap ? "MDAP" : "Baseline"} trial: ${config.trialId}`,
  );
  console.log(
    `   Model: ${config.model}, Batches: ${stepsToRun}${config.useMdap ? " (parallel voting)" : ""}`,
  );

  for (let i = 0; i < stepsToRun; i++) {
    const stepStart = Date.now();
    const stepInstruction = stepsToUse[i];

    try {
      let result: {
        code: string;
        inputTokens: number;
        outputTokens: number;
        samples?: number;
      };

      if (config.useMdap) {
        result = await callLLMWithMDAP(
          client,
          config,
          currentCode,
          stepInstruction,
        );
      } else {
        result = await callLLM(client, config, currentCode, stepInstruction);
        result.samples = 1;
      }

      const stepResult: StepResult = {
        step: i + 1,
        action: stepInstruction.slice(0, 50) + "...",
        code: result.code,
        samples: result.samples || 1,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        timeMs: Date.now() - stepStart,
      };

      steps.push(stepResult);
      currentCode = result.code;
      totalInputTokens += result.inputTokens;
      totalOutputTokens += result.outputTokens;

      // Progress indicator
      const progress = Math.round(((i + 1) / stepsToRun) * 100);
      const samplesInfo = config.useMdap ? ` (${result.samples} samples)` : "";
      const timeInfo = `${((Date.now() - stepStart) / 1000).toFixed(1)}s`;
      process.stdout.write(
        `\r   Batch ${i + 1}/${stepsToRun} (${progress}%)${samplesInfo} ${timeInfo}   `,
      );
    } catch (error) {
      const stepResult: StepResult = {
        step: i + 1,
        action: stepInstruction.slice(0, 50) + "...",
        code: currentCode,
        samples: 0,
        inputTokens: 0,
        outputTokens: 0,
        timeMs: Date.now() - stepStart,
        error: error instanceof Error ? error.message : String(error),
      };

      steps.push(stepResult);
      console.error(`\n   ❌ Error at batch ${i + 1}: ${stepResult.error}`);
      break;
    }
  }

  const totalTimeMs = Date.now() - startTime;
  const estimatedCost = calculateCost(
    config.model,
    totalInputTokens,
    totalOutputTokens,
  );

  console.log(`\n   ✓ Completed in ${(totalTimeMs / 1000).toFixed(1)}s`);
  console.log(`   💰 Cost: $${estimatedCost.toFixed(4)}`);

  // Save output HTML
  const outputPath = path.join(config.outputDir, config.trialId, "index.html");
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, currentCode);
  console.log(`   📁 Output: ${outputPath}`);

  return {
    config,
    steps,
    finalCode: currentCode,
    totalSteps: steps.length,
    completed: steps.length === stepsToRun && !steps[steps.length - 1]?.error,
    totalTimeMs,
    totalInputTokens,
    totalOutputTokens,
    estimatedCost,
  };
}

// Run if executed directly
const isMain = process.argv[1]?.includes("agent-loop");
if (isMain) {
  const config: AgentConfig = {
    model: process.env.MODEL || "gpt-4.1-mini",
    useMdap: process.env.USE_MDAP === "true",
    k: parseInt(process.env.K || "3"),
    temperature: parseFloat(process.env.TEMPERATURE || "0.1"),
    maxSteps: parseInt(process.env.MAX_STEPS || "17"), // 17 batched steps
    outputDir: path.join(__dirname, "outputs"),
    trialId: `test-${Date.now()}`,
  };

  runAgent(config)
    .then((result) => {
      console.log("\n📊 Trial Summary:");
      console.log(`   Batches: ${result.totalSteps}`);
      console.log(`   Completed: ${result.completed}`);
      console.log(`   Cost: $${result.estimatedCost.toFixed(4)}`);

      // Save result JSON
      const resultPath = path.join(
        __dirname,
        "results",
        `${config.trialId}.json`,
      );
      fs.writeFileSync(resultPath, JSON.stringify(result, null, 2));
    })
    .catch(console.error);
}
