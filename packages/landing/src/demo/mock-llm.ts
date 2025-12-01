/**
 * Mock LLM responses for the interactive demo.
 * Simulates realistic LLM behavior with intentional variance.
 */

export type TicketCategory = 'BILLING' | 'TECHNICAL' | 'SHIPPING' | 'ACCOUNT' | 'ESCALATE';

export interface Ticket {
  id: string;
  subject: string;
  body: string;
  correctCategory: TicketCategory;
  responsePool: TicketCategory[];
}

export interface LLMResponse {
  category: TicketCategory;
  confidence: number;
  delay: number;
}

// Sample tickets with realistic variance in responses
export const SAMPLE_TICKETS: Ticket[] = [
  {
    id: 'ticket-001',
    subject: 'Payment Failed',
    body: "My payment didn't go through but I was charged twice. Please help!",
    correctCategory: 'BILLING',
    responsePool: ['BILLING', 'BILLING', 'BILLING', 'TECHNICAL', 'BILLING'],
  },
  {
    id: 'ticket-002',
    subject: 'App Crash',
    body: 'The app crashes every time I try to upload photos. This is frustrating.',
    correctCategory: 'TECHNICAL',
    responsePool: ['TECHNICAL', 'TECHNICAL', 'ACCOUNT', 'TECHNICAL', 'TECHNICAL'],
  },
  {
    id: 'ticket-003',
    subject: 'Wrong Address',
    body: 'I need to change my delivery address before my order ships tomorrow.',
    correctCategory: 'SHIPPING',
    responsePool: ['SHIPPING', 'SHIPPING', 'SHIPPING', 'ACCOUNT', 'SHIPPING'],
  },
  {
    id: 'ticket-004',
    subject: 'Password Reset',
    body: "I can't log in and the password reset email never arrives.",
    correctCategory: 'ACCOUNT',
    responsePool: ['ACCOUNT', 'TECHNICAL', 'ACCOUNT', 'ACCOUNT', 'ACCOUNT'],
  },
  {
    id: 'ticket-005',
    subject: 'Terrible Service',
    body: "Your service is absolutely terrible! I've been waiting 3 weeks for a refund. I want to speak to a manager immediately!",
    correctCategory: 'ESCALATE',
    responsePool: ['BILLING', 'ESCALATE', 'ESCALATE', 'BILLING', 'ESCALATE'],
  },
];

/**
 * Simulates an LLM API call with realistic delay and variance.
 */
export async function mockLLMCall(ticket: Ticket): Promise<LLMResponse> {
  // Simulate network latency (200-800ms)
  const delay = 200 + Math.random() * 600;
  await sleep(delay);

  // Pick a random response from the pool (simulates LLM variance)
  const randomIndex = Math.floor(Math.random() * ticket.responsePool.length);
  const category = ticket.responsePool[randomIndex];

  // Confidence varies based on whether it's the correct answer
  const isCorrect = category === ticket.correctCategory;
  const confidence = isCorrect ? 0.85 + Math.random() * 0.14 : 0.6 + Math.random() * 0.25;

  return {
    category,
    confidence,
    delay,
  };
}

/**
 * Simulates MDAP voting with k samples.
 */
export async function mockMDAPVoting(
  ticket: Ticket,
  k: number,
  onSampleComplete?: (index: number, response: LLMResponse) => void
): Promise<{
  winner: TicketCategory;
  confidence: number;
  samples: LLMResponse[];
  totalSamples: number;
}> {
  const samples: LLMResponse[] = [];
  const votes: Map<TicketCategory, number> = new Map();

  let winner: TicketCategory | null = null;
  void k; // Used in logic below

  while (winner === null && samples.length < 15) {
    // Safety limit
    const response = await mockLLMCall(ticket);
    samples.push(response);

    const currentVotes = (votes.get(response.category) || 0) + 1;
    votes.set(response.category, currentVotes);

    onSampleComplete?.(samples.length - 1, response);

    // Check if any category has k votes ahead
    const maxVotes = Math.max(...votes.values());
    const secondMaxVotes = [...votes.values()].sort((a, b) => b - a)[1] || 0;

    if (maxVotes >= secondMaxVotes + k) {
      // Find the winner
      for (const [cat, v] of votes.entries()) {
        if (v === maxVotes) {
          winner = cat;
          break;
        }
      }
    }

    // Simple fallback: if we have k samples and clear majority
    if (samples.length >= k && maxVotes >= k) {
      for (const [cat, v] of votes.entries()) {
        if (v === maxVotes) {
          winner = cat;
          break;
        }
      }
    }
  }

  // Calculate confidence as vote percentage
  const totalVotes = samples.length;
  const winnerVotes = votes.get(winner!) || 0;
  const confidence = winnerVotes / totalVotes;

  return {
    winner: winner!,
    confidence,
    samples,
    totalSamples: samples.length,
  };
}

/**
 * Single LLM call (no MDAP) for comparison.
 */
export async function mockSingleCall(ticket: Ticket): Promise<LLMResponse> {
  return mockLLMCall(ticket);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Statistics for the demo
export const DEMO_STATS = {
  singleCallAccuracy: 0.94, // 94% accuracy without MDAP
  mdapAccuracy: 0.998, // 99.8% accuracy with MDAP
  reliabilityImprovement: 30, // 30x improvement
  avgSamplesPerCall: 3.2, // Average samples needed
  costPerClassification: 0.003, // $0.003 per classification
};
