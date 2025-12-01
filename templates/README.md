# MDAP Templates for Claude Code

Ready-to-use subagents and hooks that bring MDAP reliability patterns to your Claude Code workflow.

## Quick Start

### Install Subagents

Copy to your project:
```bash
cp -r templates/agents/* .claude/agents/
```

Or copy to user-level (available in all projects):
```bash
cp -r templates/agents/* ~/.claude/agents/
```

### Install Hooks

Merge with your Claude Code settings:
```bash
# Project-level
cp templates/hooks/mdap-hooks.json .claude/settings.json

# Or user-level
# Manually merge with ~/.claude/settings.json
```

## Available Subagents

### `mdap-executor`
Execute multi-step tasks with MDAP reliability patterns.

**Use when:**
- Processing large datasets where each record needs individual handling
- Multi-file refactoring where each file change is independent
- Any task where a single error would invalidate all work

**Example:**
```
Use the mdap-executor to process all files in src/
```

### `mdap-validator`
Validate LLM outputs using MDAP red-flag patterns.

**Use when:**
- Before using LLM output for code generation
- Before committing LLM-generated changes
- Quality assurance on batch LLM operations

**Example:**
```
Use the mdap-validator to check this JSON output
```

### `mdap-decomposer`
Break down complex tasks into maximally decomposed single-step operations.

**Use when:**
- Before starting any multi-step implementation
- When a task feels "complex" or "risky"
- When you want to parallelize work across agents

**Example:**
```
Use the mdap-decomposer to plan implementing user authentication
```

## Available Hooks

### PostToolUse: Response Length Check
Warns when Edit/Write/MultiEdit outputs exceed 750 tokens (signs of confused reasoning).

### PreToolUse: Command Chain Check
Blocks Bash commands with >3 chained operations (should be decomposed).

## Combining Everything

For maximum reliability:

1. **Decompose first**: Use `mdap-decomposer` to break down the task
2. **Execute reliably**: Use `mdap-executor` to run each step
3. **Auto-validate**: Hooks catch red flags automatically
4. **Final check**: Use `mdap-validator` for critical outputs

## Learn More

- [MDAP Paper](https://arxiv.org/abs/2511.09030) - "Solving a Million-Step LLM Task with Zero Errors"
- [Claude Code Subagents Docs](https://code.claude.com/docs/en/sub-agents)
- [Claude Code Hooks Docs](https://code.claude.com/docs/en/hooks)
