/**
 * Convergence Animation - Visual demonstration of MDAP voting
 * Shows votes appearing and converging to consensus without any API calls
 */

interface AnimationState {
  tallies: Record<string, number>;
  winner: string | null;
  phase: 'voting' | 'consensus' | 'complete';
  voteCount: number;
}

const CATEGORIES = ['BILLING', 'TECHNICAL', 'SHIPPING', 'ACCOUNT'];
const CATEGORY_COLORS: Record<string, string> = {
  BILLING: '#fbbf24',    // amber
  TECHNICAL: '#22d3ee',  // cyan
  SHIPPING: '#a78bfa',   // purple
  ACCOUNT: '#22c55e',    // green
};

// Predetermined voting sequence that converges to BILLING
const VOTE_SEQUENCE = [
  { answer: 'BILLING', delay: 0 },
  { answer: 'TECHNICAL', delay: 600 },
  { answer: 'BILLING', delay: 1200 },
  { answer: 'BILLING', delay: 1800 },
  { answer: 'SHIPPING', delay: 2400 },
  { answer: 'BILLING', delay: 3000 },
  { answer: 'BILLING', delay: 3600 },
];

const K_VALUE = 3; // Consensus threshold

function createElement<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  textContent?: string
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (textContent) el.textContent = textContent;
  return el;
}

function createSvgElement(pathD: string, className?: string): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  if (className) svg.setAttribute('class', className);

  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('stroke-linecap', 'round');
  path.setAttribute('stroke-linejoin', 'round');
  path.setAttribute('d', pathD);
  svg.appendChild(path);

  return svg;
}

export function createConvergenceAnimation(container: HTMLElement): void {
  container.textContent = '';

  const wrapper = createElement('div', 'convergence-wrapper');

  // Build the layout
  const layout = createElement('div', 'convergence-layout');

  // Left: Input ticket
  const inputSection = createInputSection();
  layout.appendChild(inputSection);

  // Center: Voting visualization
  const centerSection = createCenterSection();
  layout.appendChild(centerSection);

  // Right: Result
  const outputSection = createOutputSection();
  layout.appendChild(outputSection);

  wrapper.appendChild(layout);

  // Status bar with vote count and k-ahead indicator
  const statusBar = createElement('div', 'convergence-status');
  statusBar.id = 'convergence-status';

  const voteStatus = createElement('div', 'vote-status');
  voteStatus.id = 'vote-status';
  const statusIcon = createElement('span', 'status-icon');
  statusIcon.id = 'status-icon';
  voteStatus.appendChild(statusIcon);
  const statusText = createElement('span', 'status-text', 'Starting vote collection...');
  statusText.id = 'status-text';
  voteStatus.appendChild(statusText);
  statusBar.appendChild(voteStatus);

  const kIndicator = createElement('div', 'k-indicator hidden');
  kIndicator.id = 'k-indicator';
  const kLabel = createElement('span', 'k-label', 'k=3 ahead');
  kIndicator.appendChild(kLabel);
  statusBar.appendChild(kIndicator);

  wrapper.appendChild(statusBar);

  // Progress indicator
  const progressContainer = createElement('div', 'convergence-progress');
  const progressBar = createElement('div', 'progress-bar');
  progressBar.id = 'progress-bar';
  progressContainer.appendChild(progressBar);
  wrapper.appendChild(progressContainer);

  // Replay button
  const replayBtn = createElement('button', 'replay-btn hidden');
  replayBtn.id = 'replay-btn';
  replayBtn.appendChild(createSvgElement('M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15'));
  replayBtn.appendChild(document.createTextNode(' Watch Again'));
  wrapper.appendChild(replayBtn);

  container.appendChild(wrapper);

  // Initialize visual elements
  initOrbitRings();
  initCategoryTargets();

  // Start animation
  setTimeout(() => runAnimation(), 800);
}

function createInputSection(): HTMLElement {
  const section = createElement('div', 'convergence-input');

  // Stage label
  const stageLabel = createElement('div', 'stage-label');
  stageLabel.appendChild(createElement('span', 'stage-number', '1'));
  stageLabel.appendChild(createElement('span', 'stage-text', 'Input'));
  section.appendChild(stageLabel);

  // Ticket card
  const ticket = createElement('div', 'ticket-card');

  const header = createElement('div', 'ticket-header');
  header.appendChild(createElement('span', 'ticket-label', 'Support Ticket'));
  header.appendChild(createElement('span', 'ticket-id', '#4821'));
  ticket.appendChild(header);

  const content = createElement('p', 'ticket-content', '"I was charged twice for my subscription this month and need a refund processed immediately."');
  ticket.appendChild(content);

  const footer = createElement('div', 'ticket-footer');
  const priorityBadge = createElement('span', 'priority-badge priority-high');
  priorityBadge.appendChild(createElement('span', 'priority-dot'));
  priorityBadge.appendChild(document.createTextNode('High Priority'));
  footer.appendChild(priorityBadge);
  ticket.appendChild(footer);

  section.appendChild(ticket);

  // Arrow
  const arrow = createElement('div', 'input-arrow');
  const arrowInner = createElement('div', 'arrow-inner');
  arrowInner.appendChild(createSvgElement('M13 7l5 5m0 0l-5 5m5-5H6'));
  arrow.appendChild(arrowInner);
  section.appendChild(arrow);

  return section;
}

function createCenterSection(): HTMLElement {
  const section = createElement('div', 'convergence-center');

  // Stage label
  const stageLabel = createElement('div', 'stage-label');
  stageLabel.appendChild(createElement('span', 'stage-number', '2'));
  stageLabel.appendChild(createElement('span', 'stage-text', 'Vote'));
  section.appendChild(stageLabel);

  // Voting arena
  const arena = createElement('div', 'voting-arena');
  arena.id = 'voting-arena';

  // Orbit rings
  const orbits = createElement('div', 'orbit-rings');
  orbits.id = 'orbit-rings';
  arena.appendChild(orbits);

  // Center target
  const arenaCenter = createElement('div', 'arena-center');

  // Multiple pulse layers for depth
  const arenaPulse1 = createElement('div', 'arena-pulse arena-pulse-1');
  const arenaPulse2 = createElement('div', 'arena-pulse arena-pulse-2');
  const arenaPulse3 = createElement('div', 'arena-pulse arena-pulse-3');

  const arenaCore = createElement('div', 'arena-core');
  arenaCore.id = 'arena-core';
  const arenaLabel = createElement('span', 'arena-label', '?');
  arenaCore.appendChild(arenaLabel);

  arenaCenter.appendChild(arenaPulse1);
  arenaCenter.appendChild(arenaPulse2);
  arenaCenter.appendChild(arenaPulse3);
  arenaCenter.appendChild(arenaCore);
  arena.appendChild(arenaCenter);

  // Shockwave element (hidden until consensus)
  const shockwave = createElement('div', 'arena-shockwave hidden');
  shockwave.id = 'arena-shockwave';
  arena.appendChild(shockwave);

  // Vote particles container
  const particles = createElement('div', 'vote-particles-container');
  particles.id = 'vote-particles';
  arena.appendChild(particles);

  // Category targets
  const targets = createElement('div', 'category-targets');
  targets.id = 'category-targets';
  arena.appendChild(targets);

  section.appendChild(arena);

  // Vote tally
  const tally = createElement('div', 'vote-tally');
  tally.id = 'vote-tally';

  CATEGORIES.forEach(cat => {
    const item = createElement('div', 'tally-item');
    item.dataset.category = cat;

    const dot = createElement('span', 'tally-dot');
    dot.style.setProperty('--color', CATEGORY_COLORS[cat]);
    item.appendChild(dot);

    item.appendChild(createElement('span', 'tally-label', cat));

    const count = createElement('span', 'tally-count', '0');
    count.id = `tally-${cat}`;
    item.appendChild(count);

    // Vote bar visualization
    const bar = createElement('div', 'tally-bar');
    bar.id = `bar-${cat}`;
    bar.style.setProperty('--color', CATEGORY_COLORS[cat]);
    item.appendChild(bar);

    tally.appendChild(item);
  });

  section.appendChild(tally);

  return section;
}

function createOutputSection(): HTMLElement {
  const section = createElement('div', 'convergence-output');
  section.id = 'convergence-output';

  // Stage label
  const stageLabel = createElement('div', 'stage-label');
  stageLabel.appendChild(createElement('span', 'stage-number', '3'));
  stageLabel.appendChild(createElement('span', 'stage-text', 'Result'));
  section.appendChild(stageLabel);

  const resultContainer = createElement('div', 'result-container');
  resultContainer.id = 'result-container';

  const waiting = createElement('div', 'result-waiting');
  const spinnerContainer = createElement('div', 'spinner-container');
  const spinner = createElement('div', 'result-spinner');
  spinnerContainer.appendChild(spinner);
  waiting.appendChild(spinnerContainer);
  waiting.appendChild(createElement('span', 'waiting-text', 'Awaiting consensus...'));
  waiting.appendChild(createElement('span', 'waiting-subtext', 'Need k=3 vote lead'));
  resultContainer.appendChild(waiting);

  section.appendChild(resultContainer);

  return section;
}

function initOrbitRings(): void {
  const container = document.getElementById('orbit-rings');
  if (!container) return;

  // Create 3 orbit rings with different sizes
  [1, 2, 3].forEach(i => {
    const ring = createElement('div', `orbit-ring orbit-ring-${i}`);
    container.appendChild(ring);
  });
}

function initCategoryTargets(): void {
  const targetsContainer = document.getElementById('category-targets');
  if (!targetsContainer) return;

  const positions = [
    { angle: -60, cat: 'BILLING' },
    { angle: 30, cat: 'TECHNICAL' },
    { angle: 120, cat: 'SHIPPING' },
    { angle: 210, cat: 'ACCOUNT' },
  ];

  positions.forEach(({ angle, cat }) => {
    const target = createElement('div', 'category-target');
    target.dataset.category = cat;
    target.style.setProperty('--angle', `${angle}deg`);
    target.style.setProperty('--color', CATEGORY_COLORS[cat]);

    const inner = createElement('div', 'target-inner');
    inner.appendChild(createElement('span', 'target-letter', cat.charAt(0)));
    inner.appendChild(createElement('span', 'target-name', cat));
    target.appendChild(inner);

    targetsContainer.appendChild(target);
  });
}

function runAnimation(): void {
  const state: AnimationState = {
    tallies: { BILLING: 0, TECHNICAL: 0, SHIPPING: 0, ACCOUNT: 0 },
    winner: null,
    phase: 'voting',
    voteCount: 0,
  };

  const particlesContainer = document.getElementById('vote-particles');
  const progressBar = document.getElementById('progress-bar');

  // Update status to show voting started
  updateStatus('voting', 0, VOTE_SEQUENCE.length);

  VOTE_SEQUENCE.forEach((vote, index) => {
    setTimeout(() => {
      state.voteCount++;
      createVoteParticle(index, vote.answer, particlesContainer);
      updateTally(vote.answer, state);
      updateProgress(index + 1, VOTE_SEQUENCE.length, progressBar);
      updateStatus('voting', index + 1, VOTE_SEQUENCE.length);

      // Check for consensus (k ahead)
      const maxVotes = Math.max(...Object.values(state.tallies));
      const leader = Object.entries(state.tallies).find(([, v]) => v === maxVotes)?.[0];
      const secondMax = Math.max(...Object.values(state.tallies).filter(v => v !== maxVotes), 0);
      const kAhead = maxVotes - secondMax;

      // Show k-ahead indicator when leader emerges
      if (kAhead >= 1 && leader) {
        showKIndicator(kAhead, leader);
      }

      if (leader && kAhead >= K_VALUE && !state.winner) {
        state.winner = leader;
        state.phase = 'consensus';
        setTimeout(() => showConsensus(leader, state), 400);
      }
    }, vote.delay);
  });

  // Fallback: show result after all votes
  setTimeout(() => {
    if (!state.winner) {
      const maxVotes = Math.max(...Object.values(state.tallies));
      const winner = Object.entries(state.tallies).find(([, v]) => v === maxVotes)?.[0] || 'BILLING';
      showConsensus(winner, state);
    }
  }, VOTE_SEQUENCE[VOTE_SEQUENCE.length - 1].delay + 600);
}

function updateStatus(phase: string, current: number, total: number): void {
  const statusText = document.getElementById('status-text');
  const statusIcon = document.getElementById('status-icon');

  if (statusText && statusIcon) {
    if (phase === 'voting') {
      statusText.textContent = `Collecting vote ${current} of ${total}`;
      statusIcon.className = 'status-icon voting';
    }
  }
}

function showKIndicator(kAhead: number, leader: string): void {
  const indicator = document.getElementById('k-indicator');
  if (!indicator) return;

  indicator.classList.remove('hidden');
  indicator.style.setProperty('--leader-color', CATEGORY_COLORS[leader]);

  const label = indicator.querySelector('.k-label');
  if (label) {
    if (kAhead >= K_VALUE) {
      label.textContent = `${leader} wins! (k=${kAhead})`;
      indicator.classList.add('consensus-reached');
    } else {
      label.textContent = `${leader} leads by ${kAhead}`;
    }
  }
}

function createVoteParticle(id: number, answer: string, container: HTMLElement | null): void {
  if (!container) return;

  const particle = createElement('div', 'vote-particle');
  particle.dataset.answer = answer;
  particle.style.setProperty('--color', CATEGORY_COLORS[answer]);

  // More varied starting positions
  const startAngle = (id * 51.43) % 360; // Golden angle for better distribution
  particle.style.setProperty('--start-angle', `${startAngle}deg`);
  particle.style.setProperty('--particle-index', `${id}`);

  // Inner content
  const inner = createElement('div', 'particle-inner');
  inner.appendChild(createElement('span', 'particle-letter', answer.charAt(0)));
  particle.appendChild(inner);

  // Trail effect
  const trail = createElement('div', 'particle-trail');
  particle.appendChild(trail);

  container.appendChild(particle);

  // Trigger animation
  requestAnimationFrame(() => {
    particle.classList.add('animate');
  });

  // Highlight the corresponding tally
  const tallyItem = document.querySelector(`.tally-item[data-category="${answer}"]`);
  tallyItem?.classList.add('pulse');
  setTimeout(() => tallyItem?.classList.remove('pulse'), 400);

  // Pulse the corresponding category target
  const categoryTarget = document.querySelector(`.category-target[data-category="${answer}"]`);
  categoryTarget?.classList.add('receiving');
  setTimeout(() => categoryTarget?.classList.remove('receiving'), 600);
}

function updateTally(answer: string, state: AnimationState): void {
  state.tallies[answer]++;

  const countEl = document.getElementById(`tally-${answer}`);
  if (countEl) {
    countEl.textContent = String(state.tallies[answer]);
    countEl.classList.add('bump');
    setTimeout(() => countEl.classList.remove('bump'), 300);
  }

  // Update vote bars
  const maxPossible = VOTE_SEQUENCE.length;
  Object.entries(state.tallies).forEach(([cat, count]) => {
    const bar = document.getElementById(`bar-${cat}`);
    if (bar) {
      const percent = (count / maxPossible) * 100;
      bar.style.width = `${percent}%`;
    }
  });
}

function updateProgress(current: number, total: number, progressBar: HTMLElement | null): void {
  if (!progressBar) return;
  progressBar.style.width = `${(current / total) * 100}%`;
}

function showConsensus(winner: string, state: AnimationState): void {
  // Trigger shockwave effect
  const shockwave = document.getElementById('arena-shockwave');
  if (shockwave) {
    shockwave.classList.remove('hidden');
    shockwave.style.setProperty('--winner-color', CATEGORY_COLORS[winner]);
    shockwave.classList.add('animate');
  }

  // Update arena core
  const arenaCore = document.getElementById('arena-core');
  if (arenaCore) {
    arenaCore.style.setProperty('--winner-color', CATEGORY_COLORS[winner]);
    arenaCore.classList.add('consensus');
    arenaCore.textContent = '';

    const checkmark = createSvgElement('M5 13l4 4L19 7', 'consensus-check');
    arenaCore.appendChild(checkmark);
  }

  // Update status
  const statusText = document.getElementById('status-text');
  const statusIcon = document.getElementById('status-icon');
  if (statusText && statusIcon) {
    statusText.textContent = 'Consensus achieved!';
    statusIcon.className = 'status-icon success';
  }

  // Update output section with result
  const resultContainer = document.getElementById('result-container');
  if (resultContainer) {
    resultContainer.textContent = '';

    const success = createElement('div', 'result-success');

    const badge = createElement('div', 'result-badge');
    badge.style.setProperty('--color', CATEGORY_COLORS[winner]);
    badge.appendChild(createSvgElement('M5 13l4 4L19 7'));
    success.appendChild(badge);

    const content = createElement('div', 'result-content');
    content.appendChild(createElement('span', 'result-label', 'Classification'));

    const value = createElement('span', 'result-value', winner);
    value.style.color = CATEGORY_COLORS[winner];
    content.appendChild(value);

    const confidence = createElement('div', 'result-confidence');
    confidence.appendChild(createElement('span', 'confidence-value', '99.8%'));
    confidence.appendChild(createElement('span', 'confidence-label', 'confidence'));
    content.appendChild(confidence);

    const stats = createElement('div', 'result-stats');
    stats.appendChild(createElement('span', undefined, `${state.voteCount} votes`));
    stats.appendChild(createElement('span', 'stats-divider', '•'));
    stats.appendChild(createElement('span', undefined, `k=${K_VALUE} ahead`));
    content.appendChild(stats);

    success.appendChild(content);
    resultContainer.appendChild(success);
  }

  // Update category targets
  document.querySelectorAll('.category-target').forEach(target => {
    if (target.getAttribute('data-category') === winner) {
      target.classList.add('winner');
    } else {
      target.classList.add('dimmed');
    }
  });

  // Update tally items
  document.querySelectorAll('.tally-item').forEach(item => {
    if (item.getAttribute('data-category') === winner) {
      item.classList.add('winner');
    } else {
      item.classList.add('dimmed');
    }
  });

  // Show replay button
  setTimeout(() => {
    const replayBtn = document.getElementById('replay-btn');
    replayBtn?.classList.remove('hidden');
    replayBtn?.addEventListener('click', () => {
      const container = document.getElementById('interactive-demo');
      if (container) createConvergenceAnimation(container);
    }, { once: true });
  }, 800);
}
