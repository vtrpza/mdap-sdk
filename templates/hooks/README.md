# MDAP Hooks for Claude Code

These hooks integrate MDAP red-flag checking into your Claude Code workflow.

## Installation

Copy the hooks configuration to your Claude Code settings:

### Project-level (recommended)
```bash
cp mdap-hooks.json /path/to/your/project/.claude/settings.json
```

### User-level
```bash
# Merge with your existing ~/.claude/settings.json
```

## What These Hooks Do

### PostToolUse: Response Length Check
After any `Edit`, `Write`, or `MultiEdit` operation, checks if the output exceeds 750 tokens (estimated). This catches responses that are likely confused or over-complicated.

**Trigger**: Edit, Write, MultiEdit tools
**Action**: Warns if output > 750 tokens

### PreToolUse: Command Chain Check
Before running Bash commands, checks if the command chain is too long (>3 chained commands). Long command chains should be decomposed into separate steps for reliability.

**Trigger**: Bash tool
**Action**: Blocks commands with >3 `&&` chains

## Customization

### Adjust Token Threshold
Edit the `750` value in the PostToolUse hook to change the maximum allowed tokens:

```javascript
if (tokens > 500) { // More strict
```

### Add JSON Validation
Add another PostToolUse hook to validate JSON outputs:

```json
{
  "matcher": "Edit|Write",
  "hooks": [
    {
      "type": "command",
      "command": "node -e \"const input = require('fs').readFileSync('/dev/stdin', 'utf8'); const data = JSON.parse(input); const content = data.tool_output || ''; if (content.includes('{')) { try { JSON.parse(content); } catch { console.error('⚠️ MDAP Red Flag: Invalid JSON in output'); process.exit(1); } }\""
    }
  ]
}
```

## Why These Hooks?

From the MDAP paper "Solving a Million-Step LLM Task with Zero Errors":

> "Red-flagging is crucial for reducing correlated errors. Error rate increases sharply when response exceeds ~700 tokens."

These hooks implement the paper's findings as automatic safeguards in your development workflow.

## Combining with Subagents

For maximum reliability:
1. Use the `mdap-decomposer` agent to break down tasks
2. Use the `mdap-executor` agent to run steps
3. Let these hooks catch any red flags automatically
4. Use the `mdap-validator` agent for final verification
