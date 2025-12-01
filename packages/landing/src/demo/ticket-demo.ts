/**
 * Interactive ticket classification demo component.
 * Demonstrates MDAP voting vs single LLM call.
 */

import {
  SAMPLE_TICKETS,
  mockMDAPVoting,
  mockSingleCall,
  DEMO_STATS,
  type Ticket,
  type LLMResponse,
} from './mock-llm';
import { createVotingVisualizer, calculateTallies } from './voting-visualizer';

export type DemoMode = 'mdap' | 'single';

interface DemoState {
  currentTicket: Ticket;
  mode: DemoMode;
  isRunning: boolean;
  k: number;
}

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

/**
 * Creates the complete ticket demo component.
 */
export function createTicketDemo(container: HTMLElement): {
  setMode: (mode: DemoMode) => void;
  setTicket: (index: number) => void;
  run: () => Promise<void>;
  reset: () => void;
} {
  const state: DemoState = {
    currentTicket: SAMPLE_TICKETS[0],
    mode: 'mdap',
    isRunning: false,
    k: 3,
  };

  // Clear container
  while (container.firstChild) {
    container.removeChild(container.firstChild);
  }

  const wrapper = createElement('div', 'ticket-demo grid md:grid-cols-2 gap-8');

  // Left side: Ticket display
  const leftPanel = createElement('div', 'ticket-panel');

  // Ticket selector
  const selectorWrapper = createElement('div', 'mb-4');
  const selectorLabel = createElement('label', 'block text-sm font-medium text-gray-400 mb-2', 'Select Ticket');
  const selector = createElement('select', 'w-full bg-mdap-dark border border-gray-700 rounded-lg px-4 py-2 text-white focus:border-mdap-primary focus:outline-none');
  selector.id = 'ticket-selector';

  SAMPLE_TICKETS.forEach((ticket, index) => {
    const option = createElement('option');
    option.value = String(index);
    option.textContent = `#${ticket.id.split('-')[1]} - ${ticket.subject}`;
    selector.appendChild(option);
  });

  selectorWrapper.appendChild(selectorLabel);
  selectorWrapper.appendChild(selector);

  // Ticket card
  const ticketCard = createElement('div', 'ticket');
  const ticketHeader = createElement('div', 'ticket-header');
  const ticketIcon = createElement('div', 'w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-gray-500 text-xl', '📧');
  const ticketMeta = createElement('div');
  const ticketId = createElement('div', 'font-semibold text-gray-900', `Ticket #${state.currentTicket.id.split('-')[1]}`);
  ticketId.id = 'ticket-id';
  const ticketTime = createElement('div', 'text-sm text-gray-500', 'Just now');
  ticketMeta.appendChild(ticketId);
  ticketMeta.appendChild(ticketTime);
  ticketHeader.appendChild(ticketIcon);
  ticketHeader.appendChild(ticketMeta);

  const ticketSubject = createElement('h3', 'font-semibold text-lg text-gray-900 mb-2');
  ticketSubject.id = 'ticket-subject';
  ticketSubject.textContent = state.currentTicket.subject;

  const ticketBody = createElement('p', 'text-gray-600');
  ticketBody.id = 'ticket-body';
  ticketBody.textContent = state.currentTicket.body;

  const correctBadge = createElement('div', 'mt-4 pt-4 border-t border-gray-200');
  const correctLabel = createElement('span', 'text-xs text-gray-400', 'Correct classification: ');
  const correctValue = createElement('span', 'text-xs font-semibold text-gray-600');
  correctValue.id = 'correct-category';
  correctValue.textContent = state.currentTicket.correctCategory;
  correctBadge.appendChild(correctLabel);
  correctBadge.appendChild(correctValue);

  ticketCard.appendChild(ticketHeader);
  ticketCard.appendChild(ticketSubject);
  ticketCard.appendChild(ticketBody);
  ticketCard.appendChild(correctBadge);

  // Mode toggle
  const modeWrapper = createElement('div', 'mt-6 flex gap-4');

  const mdapBtn = createElement('button', 'flex-1 py-3 px-4 rounded-lg font-semibold transition-all');
  mdapBtn.id = 'mode-mdap';
  mdapBtn.textContent = 'With MDAP';

  const singleBtn = createElement('button', 'flex-1 py-3 px-4 rounded-lg font-semibold transition-all');
  singleBtn.id = 'mode-single';
  singleBtn.textContent = 'Without MDAP';

  modeWrapper.appendChild(mdapBtn);
  modeWrapper.appendChild(singleBtn);

  // Run button
  const runBtn = createElement('button', 'btn-primary w-full mt-4', 'Classify Ticket');
  runBtn.id = 'run-btn';

  leftPanel.appendChild(selectorWrapper);
  leftPanel.appendChild(ticketCard);
  leftPanel.appendChild(modeWrapper);
  leftPanel.appendChild(runBtn);

  // Right side: Visualization
  const rightPanel = createElement('div', 'visualization-panel');
  const vizTitle = createElement('h3', 'text-xl font-semibold mb-4', 'Classification Process');
  vizTitle.id = 'viz-title';
  const vizContainer = createElement('div');
  vizContainer.id = 'viz-container';

  // Single mode result container
  const singleResult = createElement('div', 'hidden');
  singleResult.id = 'single-result';

  rightPanel.appendChild(vizTitle);
  rightPanel.appendChild(vizContainer);
  rightPanel.appendChild(singleResult);

  wrapper.appendChild(leftPanel);
  wrapper.appendChild(rightPanel);
  container.appendChild(wrapper);

  // Initialize voting visualizer
  const visualizer = createVotingVisualizer(vizContainer, 5);

  // Update mode button styles
  function updateModeButtons() {
    const activeClass = 'bg-mdap-primary text-white';
    const inactiveClass = 'bg-mdap-dark border border-gray-700 text-gray-400 hover:border-mdap-primary';

    mdapBtn.className = `flex-1 py-3 px-4 rounded-lg font-semibold transition-all ${state.mode === 'mdap' ? activeClass : inactiveClass}`;
    singleBtn.className = `flex-1 py-3 px-4 rounded-lg font-semibold transition-all ${state.mode === 'single' ? activeClass : inactiveClass}`;

    vizTitle.textContent = state.mode === 'mdap' ? 'MDAP Voting Process' : 'Single LLM Call';
    vizContainer.style.display = state.mode === 'mdap' ? 'block' : 'none';
    singleResult.style.display = state.mode === 'single' ? 'block' : 'none';
  }

  // Update ticket display
  function updateTicketDisplay() {
    ticketId.textContent = `Ticket #${state.currentTicket.id.split('-')[1]}`;
    ticketSubject.textContent = state.currentTicket.subject;
    ticketBody.textContent = state.currentTicket.body;
    correctValue.textContent = state.currentTicket.correctCategory;
  }

  // Create single result display
  function showSingleResult(response: LLMResponse, isCorrect: boolean) {
    while (singleResult.firstChild) {
      singleResult.removeChild(singleResult.firstChild);
    }

    const card = createElement('div', `card ${isCorrect ? 'border-mdap-success' : 'border-mdap-error'}`);

    const resultHeader = createElement('div', 'flex items-center justify-between mb-4');
    const resultLabel = createElement('span', 'text-gray-400', 'Classification Result');
    const statusBadge = createElement('span', `px-2 py-1 text-xs font-semibold rounded ${isCorrect ? 'bg-mdap-success/20 text-mdap-success' : 'bg-mdap-error/20 text-mdap-error'}`);
    statusBadge.textContent = isCorrect ? 'Correct' : 'Incorrect';
    resultHeader.appendChild(resultLabel);
    resultHeader.appendChild(statusBadge);

    const resultValue = createElement('div', 'text-2xl font-bold mb-2', response.category);
    const confidenceText = createElement('div', 'text-sm text-gray-400', `${(response.confidence * 100).toFixed(0)}% confidence`);

    const warning = createElement('div', 'mt-4 p-3 bg-mdap-warning/10 border border-mdap-warning/30 rounded-lg');
    const warningText = createElement('p', 'text-sm text-mdap-warning');
    warningText.textContent = `Single LLM calls are ~${(DEMO_STATS.singleCallAccuracy * 100).toFixed(0)}% accurate. Over 100 tickets, expect ~${Math.round((1 - DEMO_STATS.singleCallAccuracy) * 100)} misclassifications.`;
    warning.appendChild(warningText);

    card.appendChild(resultHeader);
    card.appendChild(resultValue);
    card.appendChild(confidenceText);
    card.appendChild(warning);
    singleResult.appendChild(card);
    singleResult.classList.remove('hidden');
  }

  // Event listeners
  selector.addEventListener('change', () => {
    const index = parseInt(selector.value, 10);
    state.currentTicket = SAMPLE_TICKETS[index];
    updateTicketDisplay();
    reset();
  });

  mdapBtn.addEventListener('click', () => {
    if (state.isRunning) return;
    state.mode = 'mdap';
    updateModeButtons();
    reset();
  });

  singleBtn.addEventListener('click', () => {
    if (state.isRunning) return;
    state.mode = 'single';
    updateModeButtons();
    reset();
  });

  runBtn.addEventListener('click', () => {
    if (!state.isRunning) {
      run();
    }
  });

  // Initialize
  updateModeButtons();
  updateTicketDisplay();

  async function run() {
    if (state.isRunning) return;
    state.isRunning = true;
    runBtn.textContent = 'Classifying...';
    runBtn.classList.add('opacity-50', 'cursor-not-allowed');

    if (state.mode === 'mdap') {
      visualizer.reset();
      const responses: LLMResponse[] = [];

      const result = await mockMDAPVoting(state.currentTicket, state.k, (index, response) => {
        visualizer.updateCard(index, 'complete', response);
        responses.push(response);
        visualizer.updateTally(calculateTallies(responses));

        // Show next card as loading
        if (index < 4) {
          visualizer.updateCard(index + 1, 'loading');
        }
      });

      visualizer.updateTally(calculateTallies(responses, result.winner));
      visualizer.setWinner(result.winner, result.confidence);
    } else {
      const response = await mockSingleCall(state.currentTicket);
      const isCorrect = response.category === state.currentTicket.correctCategory;
      showSingleResult(response, isCorrect);
    }

    state.isRunning = false;
    runBtn.textContent = 'Classify Again';
    runBtn.classList.remove('opacity-50', 'cursor-not-allowed');
  }

  function reset() {
    visualizer.reset();
    while (singleResult.firstChild) {
      singleResult.removeChild(singleResult.firstChild);
    }
    singleResult.classList.add('hidden');
    runBtn.textContent = 'Classify Ticket';
  }

  function setMode(mode: DemoMode) {
    state.mode = mode;
    updateModeButtons();
    reset();
  }

  function setTicket(index: number) {
    if (index >= 0 && index < SAMPLE_TICKETS.length) {
      state.currentTicket = SAMPLE_TICKETS[index];
      selector.value = String(index);
      updateTicketDisplay();
      reset();
    }
  }

  return {
    setMode,
    setTicket,
    run,
    reset,
  };
}
