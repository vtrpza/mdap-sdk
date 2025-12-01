# MDAP SDK Landing Page

A modern, high-performance landing page for the MDAP SDK featuring a "Precision Control Center" design aesthetic inspired by NASA mission control and Bloomberg terminals.

## Tech Stack

- **Vite** - Fast build tool and dev server
- **TypeScript** - Type-safe JavaScript
- **Tailwind CSS** - Utility-first CSS framework
- **Vanilla JS** - No framework dependencies

## Design System

### Color Palette

| Token | Hex | Usage |
|-------|-----|-------|
| `void` | `#0a0a0b` | Primary background |
| `void-deep` | `#050506` | Deeper backgrounds |
| `void-surface` | `#111113` | Card surfaces |
| `amber-glow` | `#fbbf24` | Primary accent, CTAs |
| `cyan-data` | `#22d3ee` | Data visualization |
| `signal-success` | `#22c55e` | Success states |

### Typography

- **Display**: Syne (headings, hero text)
- **Body**: Inter (paragraphs, UI text)
- **Mono**: JetBrains Mono (code, stats)

### Responsive Breakpoints

- **Desktop**: > 1024px
- **Tablet**: 768px - 1024px
- **Mobile**: < 768px
- **Small Mobile**: < 480px

## Project Structure

```
packages/landing/
├── index.html          # Main HTML with all sections
├── tailwind.config.js  # Design tokens, animations
├── src/
│   ├── main.ts         # Entry point, initializations
│   ├── styles/
│   │   └── main.css    # Component styles, responsive CSS
│   └── demo/
│       ├── ticket-demo.ts   # Interactive demo component
│       └── mock-llm.ts      # Mock LLM with real stats
└── public/             # Static assets
```

## Key Features

### Interactive Demo

Side-by-side comparison showing:
- **Single LLM Call**: Shows variance and potential failures
- **MDAP Voting**: Real-time vote accumulation with confidence

```typescript
// Demo statistics from live simulation (100 iterations)
DEMO_STATS = {
  singleCallAccuracy: 0.94,      // 94% without MDAP
  mdapAccuracy: 1.0,             // 100% with MDAP
  reliabilityImprovement: 6,     // 6x improvement
  avgSamplesPerCall: 10.3,       // Average samples needed
  costPerClassification: 0.0006, // $0.0006 per call
}
```

### Animations

- Floating particles in hero section
- Orbiting particles around central visualization
- Scroll-triggered fade-in animations
- Stats counter animation on viewport entry

### Mobile Support

- Responsive navigation with hamburger menu
- Touch-optimized targets (44px minimum)
- Safe area insets for notched devices
- Reduced animations on mobile for performance

## Development

```bash
# Install dependencies
pnpm install

# Start dev server
pnpm dev

# Build for production
pnpm build

# Preview production build
pnpm preview
```

## Customization

### Adding New Sections

1. Add HTML in `index.html` with `data-animate` for scroll effects
2. Use existing component classes: `.card`, `.btn-primary`, `.section-title`
3. Follow the void/amber color scheme

### Modifying Demo Tickets

Edit `src/demo/mock-llm.ts`:

```typescript
const SAMPLE_TICKETS: Ticket[] = [
  {
    id: 'ticket-001',
    subject: 'Payment Failed',
    body: 'My payment didn\'t go through...',
    correctCategory: 'BILLING',
    responsePool: ['BILLING', 'BILLING', 'BILLING', 'TECHNICAL', 'BILLING'],
  },
  // Add more tickets...
];
```

### Updating Stats

Stats are displayed in `index.html` and animated from `src/main.ts`. The cost stat (`$0.0006`) is static for precision display.

## Performance

- Minimal JavaScript (~15KB gzipped)
- No external runtime dependencies
- Optimized CSS with Tailwind purging
- Lazy animation initialization via IntersectionObserver
