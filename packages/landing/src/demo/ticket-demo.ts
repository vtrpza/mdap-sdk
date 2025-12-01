/**
 * Interactive ticket classification demo component.
 * Dramatic side-by-side comparison: MDAP vs Single LLM Call
 *
 * Design: Precision Control Center aesthetic
 */

import {
  SAMPLE_TICKETS,
  mockMDAPVoting,
  mockSingleCall,
  DEMO_STATS,
  type Ticket,
  type LLMResponse,
  type TicketCategory,
} from './mock-llm';

const CATEGORY_COLORS: Record<TicketCategory, { bg: string; text: string; glow: string }> = {
  BILLING: { bg: 'bg-blue-500/20', text: 'text-blue-400', glow: 'shadow-blue-500/30' },
  TECHNICAL: { bg: 'bg-purple-500/20', text: 'text-purple-400', glow: 'shadow-purple-500/30' },
  SHIPPING: { bg: 'bg-orange-500/20', text: 'text-orange-400', glow: 'shadow-orange-500/30' },
  ACCOUNT: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', glow: 'shadow-emerald-500/30' },
  ESCALATE: { bg: 'bg-red-500/20', text: 'text-red-400', glow: 'shadow-red-500/30' },
};

interface DemoState {
  currentTicket: Ticket;
  ticketIndex: number;
  isRunning: boolean;
  k: number;
  mdapResult: { category: TicketCategory; confidence: number; samples: number } | null;
  singleResult: { category: TicketCategory; confidence: number } | null;
  runCount: number;
  mdapCorrect: number;
  singleCorrect: number;
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string
): HTMLElementTagNameMap[K] {
  const elem = document.createElement(tag);
  if (className) elem.className = className;
  if (text) elem.textContent = text;
  return elem;
}

/**
 * Creates the complete interactive demo component.
 */
export function createTicketDemo(container: HTMLElement): void {
  const state: DemoState = {
    currentTicket: SAMPLE_TICKETS[0],
    ticketIndex: 0,
    isRunning: false,
    k: 3,
    mdapResult: null,
    singleResult: null,
    runCount: 0,
    mdapCorrect: 0,
    singleCorrect: 0,
  };

  // Main wrapper
  const wrapper = el('div', 'demo-wrapper space-y-8');

  // ═══════════════════════════════════════════════════════════════
  // TOP: Ticket Selection & Controls
  // ═══════════════════════════════════════════════════════════════
  const controlsRow = el('div', 'flex flex-col lg:flex-row gap-6 items-start lg:items-center justify-between');

  // Ticket selector section
  const selectorSection = el('div', 'flex-1');
  const selectorLabel = el('div', 'font-mono text-xs uppercase tracking-widest text-steel-500 mb-2', 'Select Input');

  const ticketButtons = el('div', 'flex flex-wrap gap-2');
  SAMPLE_TICKETS.forEach((ticket, idx) => {
    const btn = el('button', `ticket-btn px-4 py-2 font-mono text-xs uppercase tracking-wider border transition-all duration-300 ${idx === 0 ? 'border-amber-glow/50 bg-amber-glow/10 text-amber-glow' : 'border-steel-700 text-steel-400 hover:border-amber-glow/30 hover:text-steel-200'}`);
    btn.textContent = `#${idx + 1}`;
    btn.dataset.index = String(idx);
    btn.addEventListener('click', () => selectTicket(idx));
    ticketButtons.appendChild(btn);
  });

  selectorSection.appendChild(selectorLabel);
  selectorSection.appendChild(ticketButtons);

  // Run button
  const runBtn = el('button', 'btn-primary flex items-center gap-3 min-w-[200px] justify-center');
  runBtn.id = 'demo-run-btn';
  const runIcon = el('span', '', '');
  runIcon.textContent = '\u25B6'; // Play icon
  const runText = el('span', '', 'Run Comparison');
  runBtn.appendChild(runIcon);
  runBtn.appendChild(runText);
  runBtn.addEventListener('click', runDemo);

  controlsRow.appendChild(selectorSection);
  controlsRow.appendChild(runBtn);

  // ═══════════════════════════════════════════════════════════════
  // MIDDLE: Ticket Preview
  // ═══════════════════════════════════════════════════════════════
  const ticketPreview = el('div', 'ticket-preview panel p-6');

  const ticketHeader = el('div', 'flex items-start justify-between gap-4 mb-4');
  const ticketInfo = el('div', 'flex-1');
  const ticketIdEl = el('div', 'font-mono text-2xs uppercase tracking-widest text-steel-500 mb-1');
  ticketIdEl.id = 'demo-ticket-id';
  ticketIdEl.textContent = `Ticket #${state.currentTicket.id.split('-')[1]}`;
  const ticketSubject = el('h3', 'font-display text-xl font-semibold text-steel-50');
  ticketSubject.id = 'demo-ticket-subject';
  ticketSubject.textContent = state.currentTicket.subject;
  ticketInfo.appendChild(ticketIdEl);
  ticketInfo.appendChild(ticketSubject);

  const correctBadge = el('div', 'flex flex-col items-end');
  const correctLabel = el('div', 'font-mono text-2xs uppercase tracking-widest text-steel-500 mb-1', 'Expected');
  const correctValue = el('div', 'font-mono text-sm font-bold text-signal-success');
  correctValue.id = 'demo-correct-category';
  correctValue.textContent = state.currentTicket.correctCategory;
  correctBadge.appendChild(correctLabel);
  correctBadge.appendChild(correctValue);

  ticketHeader.appendChild(ticketInfo);
  ticketHeader.appendChild(correctBadge);

  const ticketBody = el('p', 'text-steel-400 leading-relaxed');
  ticketBody.id = 'demo-ticket-body';
  ticketBody.textContent = state.currentTicket.body;

  ticketPreview.appendChild(ticketHeader);
  ticketPreview.appendChild(ticketBody);

  // ═══════════════════════════════════════════════════════════════
  // BOTTOM: Side-by-Side Comparison
  // ═══════════════════════════════════════════════════════════════
  const comparisonGrid = el('div', 'grid lg:grid-cols-2 gap-6');

  // ─── SINGLE CALL PANEL ───
  const singlePanel = el('div', 'single-panel panel p-6');
  singlePanel.id = 'demo-single-panel';

  const singleHeader = el('div', 'flex items-center justify-between mb-6');
  const singleTitle = el('div', 'flex items-center gap-3');
  const singleDot = el('div', 'w-3 h-3 rounded-full bg-signal-error/50');
  singleDot.id = 'single-status-dot';
  const singleLabel = el('h4', 'font-display text-lg font-semibold text-steel-50', 'Single LLM Call');
  singleTitle.appendChild(singleDot);
  singleTitle.appendChild(singleLabel);
  const singleBadge = el('div', 'font-mono text-2xs uppercase tracking-widest text-steel-500 px-3 py-1 border border-steel-700', 'Without MDAP');
  singleHeader.appendChild(singleTitle);
  singleHeader.appendChild(singleBadge);

  const singleContent = el('div', 'single-content min-h-[180px] flex items-center justify-center');
  singleContent.id = 'demo-single-content';
  const singlePlaceholder = el('div', 'text-center');
  const singlePlaceholderIcon = el('div', 'text-4xl text-steel-700 mb-2', '\u2022');
  const singlePlaceholderText = el('div', 'font-mono text-xs text-steel-600', 'Awaiting execution');
  singlePlaceholder.appendChild(singlePlaceholderIcon);
  singlePlaceholder.appendChild(singlePlaceholderText);
  singleContent.appendChild(singlePlaceholder);

  const singleStats = el('div', 'pt-4 mt-4 border-t border-steel-800/50 flex items-center justify-between');
  const singleAccLabel = el('div', 'font-mono text-2xs text-steel-500', 'Expected Accuracy');
  const singleAccValue = el('div', 'font-mono text-lg font-bold text-signal-error', `${(DEMO_STATS.singleCallAccuracy * 100).toFixed(0)}%`);
  singleStats.appendChild(singleAccLabel);
  singleStats.appendChild(singleAccValue);

  singlePanel.appendChild(singleHeader);
  singlePanel.appendChild(singleContent);
  singlePanel.appendChild(singleStats);

  // ─── MDAP PANEL ───
  const mdapPanel = el('div', 'mdap-panel panel p-6 border-amber-glow/20');
  mdapPanel.id = 'demo-mdap-panel';

  const mdapHeader = el('div', 'flex items-center justify-between mb-6');
  const mdapTitle = el('div', 'flex items-center gap-3');
  const mdapDot = el('div', 'w-3 h-3 rounded-full bg-amber-glow/50');
  mdapDot.id = 'mdap-status-dot';
  const mdapLabel = el('h4', 'font-display text-lg font-semibold text-steel-50', 'MDAP Voting');
  mdapTitle.appendChild(mdapDot);
  mdapTitle.appendChild(mdapLabel);
  const mdapBadge = el('div', 'font-mono text-2xs uppercase tracking-widest text-amber-glow/70 px-3 py-1 border border-amber-glow/30 bg-amber-glow/5', 'k=3');
  mdapHeader.appendChild(mdapTitle);
  mdapHeader.appendChild(mdapBadge);

  const mdapContent = el('div', 'mdap-content min-h-[180px]');
  mdapContent.id = 'demo-mdap-content';

  // Vote grid
  const voteGrid = el('div', 'vote-grid grid grid-cols-5 gap-2 mb-4');
  voteGrid.id = 'demo-vote-grid';
  for (let i = 0; i < 5; i++) {
    const voteSlot = el('div', 'vote-slot aspect-square border border-steel-800 flex items-center justify-center transition-all duration-300');
    voteSlot.id = `vote-slot-${i}`;
    const slotText = el('span', 'font-mono text-xs text-steel-700', String(i + 1));
    voteSlot.appendChild(slotText);
    voteGrid.appendChild(voteSlot);
  }

  // Tally display
  const tallySection = el('div', 'tally-section space-y-2');
  tallySection.id = 'demo-tally';

  // Result display (hidden initially)
  const mdapResultEl = el('div', 'mdap-result hidden mt-4 p-4 border border-signal-success/30 bg-signal-success/5');
  mdapResultEl.id = 'demo-mdap-result';

  mdapContent.appendChild(voteGrid);
  mdapContent.appendChild(tallySection);
  mdapContent.appendChild(mdapResultEl);

  const mdapStats = el('div', 'pt-4 mt-4 border-t border-steel-800/50 flex items-center justify-between');
  const mdapAccLabel = el('div', 'font-mono text-2xs text-steel-500', 'Expected Accuracy');
  const mdapAccValue = el('div', 'font-mono text-lg font-bold text-signal-success', `${(DEMO_STATS.mdapAccuracy * 100).toFixed(1)}%`);
  mdapStats.appendChild(mdapAccLabel);
  mdapStats.appendChild(mdapAccValue);

  mdapPanel.appendChild(mdapHeader);
  mdapPanel.appendChild(mdapContent);
  mdapPanel.appendChild(mdapStats);

  comparisonGrid.appendChild(singlePanel);
  comparisonGrid.appendChild(mdapPanel);

  // ═══════════════════════════════════════════════════════════════
  // SCOREBOARD
  // ═══════════════════════════════════════════════════════════════
  const scoreboard = el('div', 'scoreboard grid grid-cols-3 gap-4 pt-6 border-t border-steel-800/50');
  scoreboard.id = 'demo-scoreboard';

  const runsBox = el('div', 'text-center');
  const runsLabel = el('div', 'font-mono text-2xs uppercase tracking-widest text-steel-500 mb-1', 'Runs');
  const runsValue = el('div', 'font-display text-2xl font-bold text-steel-400');
  runsValue.id = 'demo-runs';
  runsValue.textContent = '0';
  runsBox.appendChild(runsLabel);
  runsBox.appendChild(runsValue);

  const singleScoreBox = el('div', 'text-center');
  const singleScoreLabel = el('div', 'font-mono text-2xs uppercase tracking-widest text-steel-500 mb-1', 'Single Correct');
  const singleScoreValue = el('div', 'font-display text-2xl font-bold text-signal-error');
  singleScoreValue.id = 'demo-single-score';
  singleScoreValue.textContent = '0';
  singleScoreBox.appendChild(singleScoreLabel);
  singleScoreBox.appendChild(singleScoreValue);

  const mdapScoreBox = el('div', 'text-center');
  const mdapScoreLabel = el('div', 'font-mono text-2xs uppercase tracking-widest text-steel-500 mb-1', 'MDAP Correct');
  const mdapScoreValue = el('div', 'font-display text-2xl font-bold text-signal-success');
  mdapScoreValue.id = 'demo-mdap-score';
  mdapScoreValue.textContent = '0';
  mdapScoreBox.appendChild(mdapScoreLabel);
  mdapScoreBox.appendChild(mdapScoreValue);

  scoreboard.appendChild(runsBox);
  scoreboard.appendChild(singleScoreBox);
  scoreboard.appendChild(mdapScoreBox);

  // Assemble everything
  wrapper.appendChild(controlsRow);
  wrapper.appendChild(ticketPreview);
  wrapper.appendChild(comparisonGrid);
  wrapper.appendChild(scoreboard);
  container.appendChild(wrapper);

  // ═══════════════════════════════════════════════════════════════
  // FUNCTIONS
  // ═══════════════════════════════════════════════════════════════

  function selectTicket(index: number): void {
    if (state.isRunning) return;

    state.ticketIndex = index;
    state.currentTicket = SAMPLE_TICKETS[index];

    // Update ticket buttons
    const buttons = ticketButtons.querySelectorAll('button');
    buttons.forEach((btn, i) => {
      if (i === index) {
        btn.className = 'ticket-btn px-4 py-2 font-mono text-xs uppercase tracking-wider border transition-all duration-300 border-amber-glow/50 bg-amber-glow/10 text-amber-glow';
      } else {
        btn.className = 'ticket-btn px-4 py-2 font-mono text-xs uppercase tracking-wider border transition-all duration-300 border-steel-700 text-steel-400 hover:border-amber-glow/30 hover:text-steel-200';
      }
    });

    // Update ticket preview
    ticketIdEl.textContent = `Ticket #${state.currentTicket.id.split('-')[1]}`;
    ticketSubject.textContent = state.currentTicket.subject;
    ticketBody.textContent = state.currentTicket.body;
    correctValue.textContent = state.currentTicket.correctCategory;

    resetResults();
  }

  function resetResults(): void {
    // Reset single panel
    const singleContent = document.getElementById('demo-single-content');
    if (singleContent) {
      while (singleContent.firstChild) singleContent.removeChild(singleContent.firstChild);
      const placeholder = el('div', 'text-center');
      const icon = el('div', 'text-4xl text-steel-700 mb-2', '\u2022');
      const text = el('div', 'font-mono text-xs text-steel-600', 'Awaiting execution');
      placeholder.appendChild(icon);
      placeholder.appendChild(text);
      singleContent.appendChild(placeholder);
    }

    // Reset vote grid
    for (let i = 0; i < 5; i++) {
      const slot = document.getElementById(`vote-slot-${i}`);
      if (slot) {
        slot.className = 'vote-slot aspect-square border border-steel-800 flex items-center justify-center transition-all duration-300';
        while (slot.firstChild) slot.removeChild(slot.firstChild);
        const slotText = el('span', 'font-mono text-xs text-steel-700', String(i + 1));
        slot.appendChild(slotText);
      }
    }

    // Reset tally
    const tally = document.getElementById('demo-tally');
    if (tally) {
      while (tally.firstChild) tally.removeChild(tally.firstChild);
    }

    // Reset result
    const result = document.getElementById('demo-mdap-result');
    if (result) {
      result.classList.add('hidden');
      while (result.firstChild) result.removeChild(result.firstChild);
    }

    // Reset status dots
    const singleDot = document.getElementById('single-status-dot');
    const mdapDot = document.getElementById('mdap-status-dot');
    if (singleDot) singleDot.className = 'w-3 h-3 rounded-full bg-signal-error/50';
    if (mdapDot) mdapDot.className = 'w-3 h-3 rounded-full bg-amber-glow/50';

    // Reset panel borders
    const singlePanel = document.getElementById('demo-single-panel');
    const mdapPanel = document.getElementById('demo-mdap-panel');
    if (singlePanel) singlePanel.className = 'single-panel panel p-6';
    if (mdapPanel) mdapPanel.className = 'mdap-panel panel p-6 border-amber-glow/20';
  }

  async function runDemo(): Promise<void> {
    if (state.isRunning) return;
    state.isRunning = true;

    // Update button
    runBtn.classList.add('opacity-50', 'cursor-not-allowed');
    runText.textContent = 'Running...';
    runIcon.textContent = '\u23F3'; // Hourglass

    resetResults();

    // Animate status dots
    const singleDot = document.getElementById('single-status-dot');
    const mdapDot = document.getElementById('mdap-status-dot');
    if (singleDot) singleDot.className = 'w-3 h-3 rounded-full bg-cyan-data animate-pulse';
    if (mdapDot) mdapDot.className = 'w-3 h-3 rounded-full bg-cyan-data animate-pulse';

    // Show loading in single panel
    const singleContentEl = document.getElementById('demo-single-content');
    if (singleContentEl) {
      while (singleContentEl.firstChild) singleContentEl.removeChild(singleContentEl.firstChild);
      const loadingDiv = el('div', 'text-center');
      const spinner = el('div', 'spinner mx-auto mb-3');
      const loadingText = el('div', 'font-mono text-xs text-cyan-data', 'Calling LLM...');
      loadingDiv.appendChild(spinner);
      loadingDiv.appendChild(loadingText);
      singleContentEl.appendChild(loadingDiv);
    }

    // Run both in parallel
    const [singleResponse, mdapResponse] = await Promise.all([
      runSingleCall(),
      runMdapVoting(),
    ]);

    // Update scoreboard
    state.runCount++;
    if (singleResponse.category === state.currentTicket.correctCategory) {
      state.singleCorrect++;
    }
    if (mdapResponse.winner === state.currentTicket.correctCategory) {
      state.mdapCorrect++;
    }

    updateScoreboard();

    // Reset button
    state.isRunning = false;
    runBtn.classList.remove('opacity-50', 'cursor-not-allowed');
    runText.textContent = 'Run Again';
    runIcon.textContent = '\u21BB'; // Refresh icon
  }

  async function runSingleCall(): Promise<LLMResponse> {
    const response = await mockSingleCall(state.currentTicket);

    const isCorrect = response.category === state.currentTicket.correctCategory;
    const colors = CATEGORY_COLORS[response.category];

    // Update single panel
    const singleContentEl = document.getElementById('demo-single-content');
    const singleDot = document.getElementById('single-status-dot');
    const singlePanel = document.getElementById('demo-single-panel');

    if (singleContentEl) {
      while (singleContentEl.firstChild) singleContentEl.removeChild(singleContentEl.firstChild);

      const resultDiv = el('div', 'text-center');

      // Category badge
      const categoryBadge = el('div', `inline-block px-6 py-3 ${colors.bg} ${colors.text} font-mono text-lg font-bold mb-4 border ${isCorrect ? 'border-signal-success/50' : 'border-signal-error/50'}`);
      categoryBadge.textContent = response.category;

      // Status
      const statusDiv = el('div', `font-mono text-sm ${isCorrect ? 'text-signal-success' : 'text-signal-error'}`);
      statusDiv.textContent = isCorrect ? '\u2713 CORRECT' : '\u2717 INCORRECT';

      // Confidence
      const confDiv = el('div', 'font-mono text-xs text-steel-500 mt-2');
      confDiv.textContent = `${(response.confidence * 100).toFixed(0)}% confidence`;

      resultDiv.appendChild(categoryBadge);
      resultDiv.appendChild(statusDiv);
      resultDiv.appendChild(confDiv);
      singleContentEl.appendChild(resultDiv);
    }

    // Update status
    if (singleDot) {
      singleDot.className = `w-3 h-3 rounded-full ${isCorrect ? 'bg-signal-success' : 'bg-signal-error'} shadow-lg ${isCorrect ? 'shadow-signal-success/50' : 'shadow-signal-error/50'}`;
    }
    if (singlePanel) {
      singlePanel.className = `single-panel panel p-6 ${isCorrect ? 'border-signal-success/30' : 'border-signal-error/30'}`;
    }

    return response;
  }

  async function runMdapVoting(): Promise<{ winner: TicketCategory; confidence: number }> {
    const votes: Map<TicketCategory, number> = new Map();
    let sampleIndex = 0;

    const result = await mockMDAPVoting(state.currentTicket, state.k, (index, response) => {
      // Update vote slot
      const slot = document.getElementById(`vote-slot-${index}`);
      if (slot) {
        const colors = CATEGORY_COLORS[response.category];
        slot.className = `vote-slot aspect-square border ${colors.text} ${colors.bg} flex items-center justify-center transition-all duration-300 scale-105`;
        while (slot.firstChild) slot.removeChild(slot.firstChild);
        const label = el('span', `font-mono text-xs font-bold ${colors.text}`);
        label.textContent = response.category.charAt(0);
        slot.appendChild(label);

        // Reset scale after animation
        setTimeout(() => {
          slot.classList.remove('scale-105');
        }, 200);
      }

      // Update vote counts
      votes.set(response.category, (votes.get(response.category) || 0) + 1);
      updateTally(votes);

      sampleIndex++;
    });

    const isCorrect = result.winner === state.currentTicket.correctCategory;
    const colors = CATEGORY_COLORS[result.winner];

    // Show result
    const resultEl = document.getElementById('demo-mdap-result');
    const mdapDot = document.getElementById('mdap-status-dot');
    const mdapPanel = document.getElementById('demo-mdap-panel');

    if (resultEl) {
      resultEl.classList.remove('hidden');
      while (resultEl.firstChild) resultEl.removeChild(resultEl.firstChild);

      resultEl.className = `mdap-result mt-4 p-4 border ${isCorrect ? 'border-signal-success/30 bg-signal-success/5' : 'border-signal-error/30 bg-signal-error/5'}`;

      const innerDiv = el('div', 'flex items-center justify-between');

      const leftDiv = el('div', 'flex items-center gap-3');
      const checkIcon = el('span', `text-2xl ${isCorrect ? 'text-signal-success' : 'text-signal-error'}`);
      checkIcon.textContent = isCorrect ? '\u2713' : '\u2717';
      const winnerLabel = el('span', 'font-display text-lg font-semibold text-steel-50');
      winnerLabel.textContent = result.winner;
      leftDiv.appendChild(checkIcon);
      leftDiv.appendChild(winnerLabel);

      const rightDiv = el('div', 'text-right');
      const confLabel = el('div', 'font-mono text-xs text-steel-500', 'Confidence');
      const confValue = el('div', 'font-mono text-lg font-bold text-signal-success');
      confValue.textContent = `${(result.confidence * 100).toFixed(0)}%`;
      const samplesLabel = el('div', 'font-mono text-2xs text-steel-600');
      samplesLabel.textContent = `${result.totalSamples} samples`;
      rightDiv.appendChild(confLabel);
      rightDiv.appendChild(confValue);
      rightDiv.appendChild(samplesLabel);

      innerDiv.appendChild(leftDiv);
      innerDiv.appendChild(rightDiv);
      resultEl.appendChild(innerDiv);
    }

    // Update status
    if (mdapDot) {
      mdapDot.className = `w-3 h-3 rounded-full ${isCorrect ? 'bg-signal-success' : 'bg-signal-error'} shadow-lg ${isCorrect ? 'shadow-signal-success/50' : 'shadow-signal-error/50'}`;
    }
    if (mdapPanel) {
      mdapPanel.className = `mdap-panel panel p-6 ${isCorrect ? 'border-signal-success/30' : 'border-signal-error/30'}`;
    }

    // Highlight winning slots
    for (let i = 0; i < 5; i++) {
      const slot = document.getElementById(`vote-slot-${i}`);
      if (slot) {
        const text = slot.querySelector('span')?.textContent;
        if (text && text === result.winner.charAt(0)) {
          slot.classList.add('shadow-lg', 'shadow-signal-success/30');
        } else if (slot.classList.contains('bg-purple-500/20') || slot.classList.contains('bg-blue-500/20') || slot.classList.contains('bg-orange-500/20') || slot.classList.contains('bg-emerald-500/20') || slot.classList.contains('bg-red-500/20')) {
          slot.classList.add('opacity-50');
        }
      }
    }

    return result;
  }

  function updateTally(votes: Map<TicketCategory, number>): void {
    const tallyEl = document.getElementById('demo-tally');
    if (!tallyEl) return;

    while (tallyEl.firstChild) tallyEl.removeChild(tallyEl.firstChild);

    const sortedVotes = [...votes.entries()].sort((a, b) => b[1] - a[1]);
    const totalVotes = [...votes.values()].reduce((a, b) => a + b, 0);

    for (const [category, count] of sortedVotes) {
      const colors = CATEGORY_COLORS[category];
      const percentage = totalVotes > 0 ? (count / totalVotes) * 100 : 0;

      const row = el('div', 'flex items-center gap-3');

      const label = el('div', `w-20 font-mono text-xs ${colors.text}`);
      label.textContent = category;

      const barContainer = el('div', 'flex-1 h-2 bg-steel-800 overflow-hidden');
      const bar = el('div', `h-full ${colors.bg} transition-all duration-300`);
      bar.style.width = `${percentage}%`;
      barContainer.appendChild(bar);

      const countEl = el('div', 'w-8 text-right font-mono text-xs text-steel-400');
      countEl.textContent = String(count);

      row.appendChild(label);
      row.appendChild(barContainer);
      row.appendChild(countEl);
      tallyEl.appendChild(row);
    }
  }

  function updateScoreboard(): void {
    const runsEl = document.getElementById('demo-runs');
    const singleEl = document.getElementById('demo-single-score');
    const mdapEl = document.getElementById('demo-mdap-score');

    if (runsEl) runsEl.textContent = String(state.runCount);
    if (singleEl) singleEl.textContent = String(state.singleCorrect);
    if (mdapEl) mdapEl.textContent = String(state.mdapCorrect);
  }
}
