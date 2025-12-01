/**
 * Code Snippets for Live Simulation
 * A collection of TypeScript code snippets for code analysis testing
 * NOTE: Some snippets intentionally contain bugs/issues for testing detection
 */

// Real code snippets from various patterns - bugs, good code, edge cases
const realSnippets = [
  // Potential bugs
  `function divide(a: number, b: number): number {
  return a / b; // No check for division by zero
}`,

  `async function fetchUser(id: string) {
  const response = await fetch(\`/api/users/\${id}\`);
  return response.json(); // No error handling
}`,

  `function findItem(arr: any[], id: number) {
  for (let i = 0; i <= arr.length; i++) { // Off-by-one error
    if (arr[i].id === id) return arr[i];
  }
}`,

  `class UserService {
  private cache: Map<string, any>;
  async getUser(id: string) {
    if (this.cache.has(id)) return this.cache.get(id);
    const user = await this.fetchUser(id);
    this.cache.set(id, user); // Cache never cleared - memory leak
    return user;
  }
}`,

  `function parseConfig(json: string): Config {
  return JSON.parse(json); // No validation, can throw
}`,

  // SQL injection risk
  `function getUserByName(name: string) {
  return db.query(\`SELECT * FROM users WHERE name = '\${name}'\`);
}`,

  // Good patterns
  `function safeDiv(a: number, b: number): number | null {
  if (b === 0) return null;
  return a / b;
}`,

  `async function fetchWithRetry<T>(url: string, retries = 3): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(\`HTTP \${res.status}\`);
      return await res.json();
    } catch (e) {
      if (i === retries - 1) throw e;
      await new Promise(r => setTimeout(r, 1000 * (i + 1)));
    }
  }
  throw new Error('Unreachable');
}`,

  `function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout>;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}`,

  // Type issues
  `function processItems(items: any[]) {
  return items.map(item => item.value.toUpperCase());
}`,

  `interface User { name: string; age: number; }
function greet(user: User | null) {
  console.log(\`Hello \${user.name}\`); // Potential null deref
}`,

  // Async issues
  `function loadData() {
  let result;
  fetch('/api/data').then(r => r.json()).then(d => result = d);
  return result; // Always undefined
}`,

  `async function processAll(items: string[]) {
  items.forEach(async (item) => { // forEach doesn't await
    await process(item);
  });
  console.log('Done'); // Logs before processing completes
}`,

  // Security issues - XSS example (intentionally vulnerable for testing)
  `function render(userInput: string) {
  // UNSAFE: Direct DOM manipulation with user input
  element.textContent = userInput; // Should use textContent, not innerHTML
}`,

  `const token = "sk-abc123"; // Hardcoded secret`,

  // Performance issues
  `function findDuplicates(arr: number[]): number[] {
  const dupes = [];
  for (let i = 0; i < arr.length; i++) {
    for (let j = i + 1; j < arr.length; j++) {
      if (arr[i] === arr[j] && !dupes.includes(arr[i])) {
        dupes.push(arr[i]); // O(n^3) complexity
      }
    }
  }
  return dupes;
}`,

  `function expensiveComputation(n: number) {
  if (n <= 1) return n;
  return expensiveComputation(n - 1) + expensiveComputation(n - 2); // No memoization
}`,

  // Edge cases
  `function isEmpty(value: any): boolean {
  return !value; // "" and 0 are falsy but not empty
}`,

  `function cloneDeep(obj: any) {
  return JSON.parse(JSON.stringify(obj)); // Loses functions, dates, undefined
}`,

  // Good error handling
  `class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500
  ) {
    super(message);
    this.name = 'AppError';
  }
}`,

  `function assertNever(x: never): never {
  throw new Error(\`Unexpected value: \${x}\`);
}`,

  // Concurrency issues
  `let counter = 0;
async function increment() {
  const current = counter;
  await delay(10);
  counter = current + 1; // Race condition
}`,

  // More complex patterns
  `class EventEmitter<T extends Record<string, any>> {
  private listeners = new Map<keyof T, Set<Function>>();

  on<K extends keyof T>(event: K, fn: (data: T[K]) => void) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(fn);
  }

  emit<K extends keyof T>(event: K, data: T[K]) {
    this.listeners.get(event)?.forEach(fn => fn(data));
  }
}`,

  `function retry<T>(
  fn: () => Promise<T>,
  options: { maxAttempts: number; delay: number; backoff?: number }
): Promise<T> {
  const { maxAttempts, delay, backoff = 1 } = options;
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const attempt = async () => {
      try {
        resolve(await fn());
      } catch (e) {
        if (++attempts >= maxAttempts) {
          reject(e);
        } else {
          setTimeout(attempt, delay * Math.pow(backoff, attempts));
        }
      }
    };
    attempt();
  });
}`,

  // API patterns
  `async function* paginate<T>(
  fetchPage: (cursor?: string) => Promise<{ data: T[]; nextCursor?: string }>
): AsyncGenerator<T> {
  let cursor: string | undefined;
  do {
    const { data, nextCursor } = await fetchPage(cursor);
    for (const item of data) yield item;
    cursor = nextCursor;
  } while (cursor);
}`,

  // State management
  `function createStore<S>(initialState: S) {
  let state = initialState;
  const listeners = new Set<(s: S) => void>();

  return {
    getState: () => state,
    setState: (partial: Partial<S>) => {
      state = { ...state, ...partial };
      listeners.forEach(fn => fn(state));
    },
    subscribe: (fn: (s: S) => void) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    }
  };
}`,

  // Validation
  `function validateEmail(email: string): boolean {
  return email.includes('@'); // Too simple validation
}`,

  `function validatePassword(pw: string): string[] {
  const errors: string[] = [];
  if (pw.length < 8) errors.push('Too short');
  if (!/[A-Z]/.test(pw)) errors.push('Need uppercase');
  if (!/[0-9]/.test(pw)) errors.push('Need number');
  return errors;
}`,

  // Resource management
  `async function withTransaction<T>(
  fn: (tx: Transaction) => Promise<T>
): Promise<T> {
  const tx = await db.beginTransaction();
  try {
    const result = await fn(tx);
    await tx.commit();
    return result;
  } catch (e) {
    await tx.rollback();
    throw e;
  }
}`,

  // Type utilities
  `type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};`,

  `type Awaited<T> = T extends Promise<infer U> ? U : T;`,

  // More edge cases
  `function formatDate(date: Date): string {
  return date.toISOString().split('T')[0]; // Assumes valid Date
}`,

  `function merge<T extends object>(target: T, source: Partial<T>): T {
  return Object.assign({}, target, source); // Shallow merge only
}`,

  `const CONFIG = {
  apiUrl: process.env.API_URL, // Could be undefined
  timeout: parseInt(process.env.TIMEOUT || '30000'),
};`,

  // Callback patterns
  `function parallel<T>(
  tasks: (() => Promise<T>)[],
  concurrency: number
): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const results: T[] = [];
    let running = 0;
    let index = 0;

    const next = () => {
      while (running < concurrency && index < tasks.length) {
        const i = index++;
        running++;
        tasks[i]()
          .then(r => { results[i] = r; })
          .catch(reject)
          .finally(() => { running--; next(); });
      }
      if (running === 0 && index === tasks.length) {
        resolve(results);
      }
    };
    next();
  });
}`,

  // React-like patterns
  `function useState<T>(initial: T): [T, (v: T | ((prev: T) => T)) => void] {
  let state = initial;
  const setState = (value: T | ((prev: T) => T)) => {
    state = typeof value === 'function' ? (value as Function)(state) : value;
    // Missing re-render trigger
  };
  return [state, setState];
}`,

  // Builder pattern
  `class QueryBuilder {
  private parts: string[] = [];

  select(fields: string[]) {
    this.parts.push(\`SELECT \${fields.join(', ')}\`);
    return this;
  }

  from(table: string) {
    this.parts.push(\`FROM \${table}\`);
    return this;
  }

  where(condition: string) {
    this.parts.push(\`WHERE \${condition}\`); // SQL injection risk
    return this;
  }

  build() {
    return this.parts.join(' ');
  }
}`,

  // Logging
  `const logger = {
  log: (...args: any[]) => console.log(new Date().toISOString(), ...args),
  error: (...args: any[]) => console.error(new Date().toISOString(), ...args),
  warn: (...args: any[]) => console.warn(new Date().toISOString(), ...args),
};`,

  // HTTP utilities
  `async function post<T, R>(url: string, data: T): Promise<R> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return res.json();
}`,

  // Caching
  `function memoize<T extends (...args: any[]) => any>(fn: T): T {
  const cache = new Map();
  return ((...args: any[]) => {
    const key = JSON.stringify(args);
    if (cache.has(key)) return cache.get(key);
    const result = fn(...args);
    cache.set(key, result);
    return result;
  }) as T;
}`,
];

// Generate more snippets programmatically
function generateSnippets(count: number): string[] {
  const snippets: string[] = [...realSnippets];

  // Variations of common patterns
  const functionNames = ['process', 'handle', 'get', 'set', 'create', 'delete', 'update', 'find', 'filter', 'map', 'reduce', 'validate', 'parse', 'format', 'convert', 'transform'];
  const dataTypes = ['User', 'Item', 'Order', 'Product', 'Event', 'Message', 'Config', 'Settings', 'Data', 'Result'];

  while (snippets.length < count) {
    const fn = functionNames[snippets.length % functionNames.length];
    const type = dataTypes[snippets.length % dataTypes.length];
    const variant = snippets.length % 10;

    switch (variant) {
      case 0:
        snippets.push(`async function ${fn}${type}(id: string): Promise<${type}> {
  const response = await fetch(\`/api/${type.toLowerCase()}s/\${id}\`);
  return response.json();
}`);
        break;
      case 1:
        snippets.push(`function ${fn}${type}s(items: ${type}[]): ${type}[] {
  return items.filter(item => item.active);
}`);
        break;
      case 2:
        snippets.push(`class ${type}Service {
  private items: ${type}[] = [];

  add(item: ${type}) { this.items.push(item); }
  remove(id: string) { this.items = this.items.filter(i => i.id !== id); }
  getAll() { return this.items; }
}`);
        break;
      case 3:
        snippets.push(`interface ${type}Repository {
  findById(id: string): Promise<${type} | null>;
  findAll(): Promise<${type}[]>;
  save(item: ${type}): Promise<void>;
  delete(id: string): Promise<void>;
}`);
        break;
      case 4:
        snippets.push(`function validate${type}(data: unknown): ${type} {
  if (!data || typeof data !== 'object') throw new Error('Invalid ${type}');
  return data as ${type};
}`);
        break;
      case 5:
        snippets.push(`const ${fn}${type} = (input: Partial<${type}>): ${type} => ({
  id: input.id ?? crypto.randomUUID(),
  createdAt: input.createdAt ?? new Date(),
  ...input,
});`);
        break;
      case 6:
        snippets.push(`export function use${type}(id: string) {
  const [data, setData] = useState<${type} | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch${type}(id).then(setData).finally(() => setLoading(false));
  }, [id]);

  return { data, loading };
}`);
        break;
      case 7:
        snippets.push(`type ${type}Action =
  | { type: 'SET_${type.toUpperCase()}'; payload: ${type} }
  | { type: 'UPDATE_${type.toUpperCase()}'; payload: Partial<${type}> }
  | { type: 'CLEAR_${type.toUpperCase()}' };`);
        break;
      case 8:
        snippets.push(`const ${type.toLowerCase()}Schema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100),
  createdAt: z.date(),
  updatedAt: z.date().optional(),
});`);
        break;
      case 9:
        snippets.push(`async function batch${fn}(ids: string[]): Promise<Map<string, ${type}>> {
  const results = await Promise.all(ids.map(id => ${fn}${type}(id)));
  return new Map(ids.map((id, i) => [id, results[i]]));
}`);
        break;
    }
  }

  return snippets.slice(0, count);
}

// Export 1000 code snippets
export const codeSnippets = generateSnippets(1000);

// Helper to get a snippet by index (with wraparound)
export function getSnippet(index: number): { code: string; name: string } {
  const snippet = codeSnippets[index % codeSnippets.length];
  const firstLine = snippet.split('\n')[0];
  const name = firstLine.match(/(?:function|class|const|interface|type|async function)\s+(\w+)/)?.[1]
    || `snippet_${index}`;
  return { code: snippet, name };
}

// Get total unique snippets
export const totalSnippets = codeSnippets.length;
