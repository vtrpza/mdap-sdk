# @mdap/landing

Interactive landing page for MDAP with live demo showcasing voting-based error correction.

## Features

- **Interactive Demo**: Real-time visualization of MDAP voting vs single LLM call
- **Ticket Classification**: 5 sample support tickets demonstrating use case
- **Before/After Comparison**: Toggle between MDAP and single-call modes
- **Animated Statistics**: Live counters showing accuracy improvements

## Development

```bash
# Start development server
pnpm landing:dev

# Build for production
pnpm landing:build

# Preview production build
pnpm landing:preview
```

## Deployment

The landing page automatically deploys to GitHub Pages when changes are pushed to main.

Manual deployment:
```bash
pnpm landing:build
# Upload packages/landing/dist to any static hosting
```

## Tech Stack

- **Vite** - Fast build tool and dev server
- **TypeScript** - Type-safe code
- **Tailwind CSS** - Utility-first styling
- **Vanilla JS** - No framework dependencies

## Structure

```
src/
├── main.ts              # Entry point
├── styles/
│   └── main.css         # Tailwind + custom styles
└── demo/
    ├── mock-llm.ts      # Simulated LLM responses
    ├── voting-visualizer.ts  # Voting animation component
    └── ticket-demo.ts   # Interactive demo component
```
