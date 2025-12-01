/**
 * Voting visualization component for the MDAP demo.
 * Shows real-time voting animation as samples come in.
 * Uses safe DOM methods - no innerHTML with dynamic content.
 */

import type { TicketCategory, LLMResponse } from './mock-llm';

export interface VoteCard {
  index: number;
  status: 'pending' | 'loading' | 'complete';
  response?: LLMResponse;
}

export interface VoteTally {
  category: TicketCategory;
  votes: number;
  percentage: number;
  isWinner: boolean;
}

const CATEGORY_COLORS: Record<TicketCategory, string> = {
  BILLING: 'bg-blue-500',
  TECHNICAL: 'bg-purple-500',
  SHIPPING: 'bg-orange-500',
  ACCOUNT: 'bg-green-500',
  ESCALATE: 'bg-red-500',
};

const CATEGORY_LABELS: Record<TicketCategory, string> = {
  BILLING: 'Billing',
  TECHNICAL: 'Technical',
  SHIPPING: 'Shipping',
  ACCOUNT: 'Account',
  ESCALATE: 'Escalate',
};

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

function createSvgIcon(): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'w-8 h-8');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('viewBox', '0 0 24 24');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('stroke-linecap', 'round');
  path.setAttribute('stroke-linejoin', 'round');
  path.setAttribute('stroke-width', '2');
  path.setAttribute('d', 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z');
  svg.appendChild(path);
  return svg;
}

/**
 * Creates the voting visualizer DOM structure using safe DOM methods.
 */
export function createVotingVisualizer(container: HTMLElement, maxCards: number = 5): {
  updateCard: (index: number, status: VoteCard['status'], response?: LLMResponse) => void;
  updateTally: (tallies: VoteTally[]) => void;
  setWinner: (category: TicketCategory, confidence: number) => void;
  reset: () => void;
} {
  // Clear container safely
  while (container.firstChild) {
    container.removeChild(container.firstChild);
  }

  const wrapper = createElement('div', 'voting-visualizer');

  // Sample Cards Section
  const cardsSection = createElement('div', 'mb-6');
  const cardsTitle = createElement('h4', 'text-sm font-semibold text-gray-400 mb-3 uppercase tracking-wide', 'LLM Samples');
  const cardsContainer = createElement('div', 'vote-cards grid grid-cols-5 gap-3');
  cardsContainer.id = 'vote-cards';
  cardsSection.appendChild(cardsTitle);
  cardsSection.appendChild(cardsContainer);

  // Vote Tally Section
  const tallySection = createElement('div', 'mb-6');
  const tallyTitle = createElement('h4', 'text-sm font-semibold text-gray-400 mb-3 uppercase tracking-wide', 'Vote Tally');
  const tallyContainer = createElement('div', 'vote-tally space-y-2');
  tallyContainer.id = 'vote-tally';
  tallySection.appendChild(tallyTitle);
  tallySection.appendChild(tallyContainer);

  // Result Section
  const resultContainer = createElement('div', 'result hidden');
  resultContainer.id = 'vote-result';
  const resultInner = createElement('div', 'flex items-center justify-center gap-4 p-4 bg-mdap-success/10 border border-mdap-success rounded-lg');
  const iconWrapper = createElement('div', 'text-mdap-success');
  iconWrapper.appendChild(createSvgIcon());
  const textWrapper = createElement('div');
  const resultCategory = createElement('div', 'text-lg font-semibold', '-');
  resultCategory.id = 'result-category';
  const resultConfidence = createElement('div', 'text-sm text-gray-400', '-');
  resultConfidence.id = 'result-confidence';
  textWrapper.appendChild(resultCategory);
  textWrapper.appendChild(resultConfidence);
  resultInner.appendChild(iconWrapper);
  resultInner.appendChild(textWrapper);
  resultContainer.appendChild(resultInner);

  wrapper.appendChild(cardsSection);
  wrapper.appendChild(tallySection);
  wrapper.appendChild(resultContainer);
  container.appendChild(wrapper);

  // Initialize cards
  for (let i = 0; i < maxCards; i++) {
    const card = createElement('div', 'vote-card pending text-center');
    card.id = `vote-card-${i}`;
    const label = createElement('div', 'text-xs text-gray-500 mb-1', `Sample ${i + 1}`);
    const content = createElement('div', 'card-content h-8 flex items-center justify-center');
    const placeholder = createElement('span', 'text-gray-600', '-');
    content.appendChild(placeholder);
    card.appendChild(label);
    card.appendChild(content);
    cardsContainer.appendChild(card);
  }

  function updateCard(index: number, status: VoteCard['status'], response?: LLMResponse) {
    const card = document.getElementById(`vote-card-${index}`);
    if (!card) return;

    card.className = `vote-card ${status}`;
    const content = card.querySelector('.card-content') as HTMLElement;

    // Clear content safely
    while (content.firstChild) {
      content.removeChild(content.firstChild);
    }

    if (status === 'loading') {
      const spinner = createElement('div', 'spinner');
      content.appendChild(spinner);
    } else if (status === 'complete' && response) {
      const colorClass = CATEGORY_COLORS[response.category];
      const badge = createElement('span', `px-2 py-1 ${colorClass} text-white text-xs font-semibold rounded`);
      badge.textContent = CATEGORY_LABELS[response.category];
      content.appendChild(badge);
    }
  }

  function updateTally(tallies: VoteTally[]) {
    // Clear tally safely
    while (tallyContainer.firstChild) {
      tallyContainer.removeChild(tallyContainer.firstChild);
    }

    for (const t of tallies) {
      const row = createElement('div', 'flex items-center gap-3');

      const labelClass = t.isWinner ? 'text-mdap-success font-semibold' : 'text-gray-400';
      const label = createElement('div', `w-20 text-sm ${labelClass}`);
      label.textContent = CATEGORY_LABELS[t.category];

      const progressBar = createElement('div', 'flex-1 progress-bar');
      const progressFill = createElement('div', `progress-fill ${t.isWinner ? 'from-mdap-success to-mdap-accent' : ''}`);
      progressFill.style.width = `${t.percentage}%`;
      progressBar.appendChild(progressFill);

      const voteCount = createElement('div', `w-16 text-right text-sm ${labelClass}`);
      voteCount.textContent = `${t.votes} vote${t.votes !== 1 ? 's' : ''}`;

      row.appendChild(label);
      row.appendChild(progressBar);
      row.appendChild(voteCount);
      tallyContainer.appendChild(row);
    }
  }

  function setWinner(category: TicketCategory, confidence: number) {
    resultContainer.classList.remove('hidden');
    resultCategory.textContent = CATEGORY_LABELS[category];
    resultConfidence.textContent = `${(confidence * 100).toFixed(0)}% confidence`;

    // Highlight winner card
    const cards = cardsContainer.querySelectorAll('.vote-card');
    cards.forEach((card) => {
      const badge = card.querySelector('span');
      if (badge?.textContent === CATEGORY_LABELS[category]) {
        card.classList.add('winner');
      } else if (card.classList.contains('complete')) {
        card.classList.add('loser');
      }
    });
  }

  function reset() {
    // Reset cards
    for (let i = 0; i < maxCards; i++) {
      const card = document.getElementById(`vote-card-${i}`);
      if (card) {
        card.className = 'vote-card pending text-center';
        const content = card.querySelector('.card-content') as HTMLElement;
        while (content.firstChild) {
          content.removeChild(content.firstChild);
        }
        const placeholder = createElement('span', 'text-gray-600', '-');
        content.appendChild(placeholder);
      }
    }

    // Clear tally
    while (tallyContainer.firstChild) {
      tallyContainer.removeChild(tallyContainer.firstChild);
    }

    // Hide result
    resultContainer.classList.add('hidden');
  }

  return {
    updateCard,
    updateTally,
    setWinner,
    reset,
  };
}

/**
 * Calculate vote tallies from responses.
 */
export function calculateTallies(responses: LLMResponse[], winner?: TicketCategory): VoteTally[] {
  const counts: Map<TicketCategory, number> = new Map();

  for (const r of responses) {
    counts.set(r.category, (counts.get(r.category) || 0) + 1);
  }

  const total = responses.length;
  const tallies: VoteTally[] = [];

  for (const [category, votes] of counts.entries()) {
    tallies.push({
      category,
      votes,
      percentage: total > 0 ? (votes / total) * 100 : 0,
      isWinner: category === winner,
    });
  }

  // Sort by votes descending
  tallies.sort((a, b) => b.votes - a.votes);

  return tallies;
}
