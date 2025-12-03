/**
 * Code Snippets Dataset for MDAP Case Study
 *
 * 50 TypeScript/JavaScript code snippets with known classifications.
 * Used to demonstrate MDAP's voting-based error correction.
 *
 * Categories:
 * - BUG: Logic errors, null pointers, off-by-one, unhandled exceptions
 * - SECURITY: SQL injection, XSS, hardcoded secrets, path traversal
 * - STYLE: Naming conventions, magic numbers, code organization
 * - PERFORMANCE: Inefficient algorithms, memory leaks, N+1 queries
 * - NONE: Clean, well-written code with no issues
 */

export interface CodeSnippet {
  id: number;
  code: string;
  expected: "BUG" | "SECURITY" | "STYLE" | "PERFORMANCE" | "NONE";
  description: string;
}

export const snippets: CodeSnippet[] = [
  // ============================================================
  // BUG (15 snippets)
  // ============================================================
  {
    id: 1,
    code: `function getFirstItem(items) {
  return items[0].name;
}`,
    expected: "BUG",
    description: "Null pointer - no check if items is empty",
  },
  {
    id: 2,
    code: `function processItems(items) {
  for (let i = 0; i <= items.length; i++) {
    console.log(items[i]);
  }
}`,
    expected: "BUG",
    description: "Off-by-one error - should be < not <=",
  },
  {
    id: 3,
    code: `async function fetchData(url) {
  const response = await fetch(url);
  return response.json();
}`,
    expected: "BUG",
    description: "Missing error handling - no check for response.ok",
  },
  {
    id: 4,
    code: `function divide(a, b) {
  return a / b;
}`,
    expected: "BUG",
    description: "Division by zero - no check if b is 0",
  },
  {
    id: 5,
    code: `function findUser(users, id) {
  return users.find(u => u.id == id);
}`,
    expected: "BUG",
    description: "Type coercion bug - using == instead of ===",
  },
  {
    id: 6,
    code: `function parseNumber(str) {
  return parseInt(str);
}`,
    expected: "BUG",
    description: "Missing radix parameter in parseInt",
  },
  {
    id: 7,
    code: `class Timer {
  start() {
    this.interval = setInterval(() => {
      this.tick();
    }, 1000);
  }
}`,
    expected: "BUG",
    description: "Memory leak - setInterval never cleared",
  },
  {
    id: 8,
    code: `function getProperty(obj, key) {
  return obj[key];
}`,
    expected: "BUG",
    description: "No null check on obj before accessing property",
  },
  {
    id: 9,
    code: `function calculateTotal(items) {
  let total;
  items.forEach(item => {
    total += item.price;
  });
  return total;
}`,
    expected: "BUG",
    description: "Uninitialized variable - total is undefined",
  },
  {
    id: 10,
    code: `async function saveAll(items) {
  items.forEach(async (item) => {
    await saveItem(item);
  });
  console.log('All saved!');
}`,
    expected: "BUG",
    description: "Async forEach - promises not awaited properly",
  },
  {
    id: 11,
    code: `function cloneObject(obj) {
  return JSON.parse(JSON.stringify(obj));
}`,
    expected: "BUG",
    description: "Loses functions, undefined, and circular refs in clone",
  },
  {
    id: 12,
    code: `function getLength(arr) {
  if (arr.length = 0) {
    return 'empty';
  }
  return arr.length;
}`,
    expected: "BUG",
    description: "Assignment instead of comparison - = vs ===",
  },
  {
    id: 13,
    code: `function addToCart(cart, item) {
  cart.items.push(item);
  cart.total =+ item.price;
}`,
    expected: "BUG",
    description: "Typo - =+ instead of +=",
  },
  {
    id: 14,
    code: `function debounce(fn, delay) {
  let timeout;
  return function() {
    clearTimeout(timeout);
    timeout = setTimeout(fn, delay);
  };
}`,
    expected: "BUG",
    description: "Lost context - fn called without proper this/args",
  },
  {
    id: 15,
    code: `function removeDuplicates(arr) {
  return arr.filter((item, index) => {
    arr.indexOf(item) === index;
  });
}`,
    expected: "BUG",
    description: "Missing return in filter callback",
  },

  // ============================================================
  // SECURITY (10 snippets)
  // ============================================================
  {
    id: 16,
    code: `function getUser(id) {
  const query = "SELECT * FROM users WHERE id = " + id;
  return db.execute(query);
}`,
    expected: "SECURITY",
    description: "SQL injection - string concatenation in query",
  },
  {
    id: 17,
    code: `app.get('/profile', (req, res) => {
  res.send('<h1>Welcome ' + req.query.name + '</h1>');
});`,
    expected: "SECURITY",
    description: "XSS vulnerability - unsanitized user input in HTML",
  },
  {
    id: 18,
    code: `const config = {
  apiKey: 'sk-1234567890abcdef',
  dbPassword: 'admin123'
};`,
    expected: "SECURITY",
    description: "Hardcoded secrets in source code",
  },
  {
    id: 19,
    code: `app.get('/file', (req, res) => {
  const filePath = './uploads/' + req.query.name;
  res.sendFile(filePath);
});`,
    expected: "SECURITY",
    description: "Path traversal - unsanitized file path",
  },
  {
    id: 20,
    code: `function runCommand(userInput) {
  eval(userInput);
}`,
    expected: "SECURITY",
    description: "Code injection - eval with user input",
  },
  {
    id: 21,
    code: `function createToken(userId) {
  return Buffer.from(userId.toString()).toString('base64');
}`,
    expected: "SECURITY",
    description: "Insecure token - base64 is not encryption",
  },
  {
    id: 22,
    code: `app.use(cors({ origin: '*' }));`,
    expected: "SECURITY",
    description: "Overly permissive CORS - allows any origin",
  },
  {
    id: 23,
    code: `function hashPassword(password) {
  return crypto.createHash('md5').update(password).digest('hex');
}`,
    expected: "SECURITY",
    description: "Weak hash - MD5 is not suitable for passwords",
  },
  {
    id: 24,
    code: `const exec = require('child_process').exec;
function runBackup(filename) {
  exec('tar -czf backup.tar.gz ' + filename);
}`,
    expected: "SECURITY",
    description: "Command injection - unsanitized shell command",
  },
  {
    id: 25,
    code: `app.post('/login', (req, res) => {
  if (req.body.password === users[req.body.username]) {
    res.cookie('auth', req.body.username);
    res.send('OK');
  }
});`,
    expected: "SECURITY",
    description:
      "Insecure auth - plain text password comparison, predictable cookie",
  },

  // ============================================================
  // STYLE (10 snippets)
  // ============================================================
  {
    id: 26,
    code: `function calc(a, b, c) {
  return a * 3.14159 + b * 2.71828 - c * 1.41421;
}`,
    expected: "STYLE",
    description: "Magic numbers - should use named constants",
  },
  {
    id: 27,
    code: `function x(y) {
  let z = y.a + y.b;
  return z > 0 ? z : -z;
}`,
    expected: "STYLE",
    description: "Poor naming - x, y, z are not descriptive",
  },
  {
    id: 28,
    code: `function processData(data) {
  // TODO: implement this later
  // console.log('processing');
  // data.map(x => x * 2);
}`,
    expected: "STYLE",
    description: "Dead code - commented out code should be removed",
  },
  {
    id: 29,
    code: `function handleUser(user, action, data, options, callback, context, metadata) {
  // function with too many parameters
  if (action === 'create') { /* ... */ }
  else if (action === 'update') { /* ... */ }
  else if (action === 'delete') { /* ... */ }
}`,
    expected: "STYLE",
    description: "Too many parameters - should use object destructuring",
  },
  {
    id: 30,
    code: `const getUserData = async (id) => {
  const userData = await fetchUser(id);
  const userDataFormatted = formatUserData(userData);
  const userDataFormattedAndValidated = validateUserData(userDataFormatted);
  return userDataFormattedAndValidated;
}`,
    expected: "STYLE",
    description: "Verbose naming - overly long variable names",
  },
  {
    id: 31,
    code: `function IsValid(Value) {
  if (Value == null) return false;
  if (Value == undefined) return false;
  if (Value == '') return false;
  return true;
}`,
    expected: "STYLE",
    description: "Inconsistent naming - PascalCase for function and param",
  },
  {
    id: 32,
    code: `export function helper1() { return 1; }
export function helper2() { return 2; }
export function helper3() { return 3; }
export function helper4() { return 4; }
export function helper5() { return 5; }`,
    expected: "STYLE",
    description: "Non-descriptive names - helper1-5 tell nothing about purpose",
  },
  {
    id: 33,
    code: `function process(data){if(data){if(data.items){if(data.items.length>0){return data.items.map(i=>i.value)}}}return[]}`,
    expected: "STYLE",
    description: "Poor formatting - no whitespace, deeply nested",
  },
  {
    id: 34,
    code: `class UserManager {
  getUser() {}
  getUserById() {}
  fetchUser() {}
  retrieveUser() {}
  loadUser() {}
}`,
    expected: "STYLE",
    description:
      "Inconsistent method naming - multiple synonyms for same action",
  },
  {
    id: 35,
    code: `// This function gets the user from the database
// It takes an id parameter
// It returns a user object
// Created by John on 2021-01-01
// Modified by Jane on 2021-02-15
function getUser(id) {
  return db.users.find(id);
}`,
    expected: "STYLE",
    description: "Excessive comments - obvious code doesn't need this much",
  },

  // ============================================================
  // PERFORMANCE (10 snippets)
  // ============================================================
  {
    id: 36,
    code: `async function getOrdersWithProducts(orderIds) {
  const orders = [];
  for (const id of orderIds) {
    const order = await db.orders.findById(id);
    order.products = await db.products.findByOrderId(id);
    orders.push(order);
  }
  return orders;
}`,
    expected: "PERFORMANCE",
    description: "N+1 query problem - should batch database queries",
  },
  {
    id: 37,
    code: `function findInArray(arr, value) {
  for (let i = 0; i < arr.length; i++) {
    if (JSON.stringify(arr[i]) === JSON.stringify(value)) {
      return i;
    }
  }
  return -1;
}`,
    expected: "PERFORMANCE",
    description: "Inefficient comparison - JSON.stringify in loop",
  },
  {
    id: 38,
    code: `function processLargeArray(items) {
  return items
    .filter(x => x.active)
    .map(x => x.value)
    .filter(x => x > 0)
    .map(x => x * 2)
    .filter(x => x < 100);
}`,
    expected: "PERFORMANCE",
    description: "Multiple iterations - should combine into single pass",
  },
  {
    id: 39,
    code: `function memoizedFib(n, memo) {
  if (n <= 1) return n;
  return memoizedFib(n - 1) + memoizedFib(n - 2);
}`,
    expected: "PERFORMANCE",
    description: "Unused memo parameter - exponential time complexity",
  },
  {
    id: 40,
    code: `app.get('/search', (req, res) => {
  const results = fs.readFileSync('./large-data.json');
  const data = JSON.parse(results);
  const filtered = data.filter(x => x.name.includes(req.query.q));
  res.json(filtered);
});`,
    expected: "PERFORMANCE",
    description: "Sync file read in request handler - blocks event loop",
  },
  {
    id: 41,
    code: `function hasDuplicate(arr) {
  for (let i = 0; i < arr.length; i++) {
    for (let j = 0; j < arr.length; j++) {
      if (i !== j && arr[i] === arr[j]) {
        return true;
      }
    }
  }
  return false;
}`,
    expected: "PERFORMANCE",
    description: "O(n²) when O(n) is possible with Set",
  },
  {
    id: 42,
    code: `function buildString(items) {
  let result = '';
  for (const item of items) {
    result = result + '<li>' + item + '</li>';
  }
  return '<ul>' + result + '</ul>';
}`,
    expected: "PERFORMANCE",
    description: "String concatenation in loop - should use array.join()",
  },
  {
    id: 43,
    code: `function createHandlers(buttons) {
  buttons.forEach(button => {
    button.addEventListener('click', function() {
      console.log('clicked:', this.id);
    });
  });
}`,
    expected: "PERFORMANCE",
    description: "Creates new function for each button - should share handler",
  },
  {
    id: 44,
    code: `const cache = {};
function getData(key) {
  if (!cache[key]) {
    cache[key] = expensiveOperation(key);
  }
  return cache[key];
}`,
    expected: "PERFORMANCE",
    description: "Unbounded cache - memory leak over time",
  },
  {
    id: 45,
    code: `function renderList(items) {
  const container = document.getElementById('list');
  items.forEach(item => {
    const div = document.createElement('div');
    div.textContent = item;
    container.appendChild(div);
  });
}`,
    expected: "PERFORMANCE",
    description: "DOM manipulation in loop - should use DocumentFragment",
  },

  // ============================================================
  // NONE (5 snippets) - Clean, well-written code
  // ============================================================
  {
    id: 46,
    code: `function calculateTotal(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return 0;
  }
  return items.reduce((sum, item) => sum + (item.price ?? 0), 0);
}`,
    expected: "NONE",
    description: "Clean code - proper null checks and reduce",
  },
  {
    id: 47,
    code: `async function fetchUserSafely(id) {
  try {
    const response = await fetch(\`/api/users/\${encodeURIComponent(id)}\`);
    if (!response.ok) {
      throw new Error(\`HTTP \${response.status}\`);
    }
    return await response.json();
  } catch (error) {
    console.error('Failed to fetch user:', error);
    return null;
  }
}`,
    expected: "NONE",
    description: "Clean code - proper error handling and URL encoding",
  },
  {
    id: 48,
    code: `const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

async function fetchWithRetry(url, retries = MAX_RETRIES) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url);
      if (response.ok) return response;
    } catch (error) {
      if (attempt === retries) throw error;
      await new Promise(r => setTimeout(r, RETRY_DELAY_MS * attempt));
    }
  }
}`,
    expected: "NONE",
    description: "Clean code - retry logic with exponential backoff",
  },
  {
    id: 49,
    code: `function debounce(fn, delay) {
  let timeoutId;
  return function(...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn.apply(this, args), delay);
  };
}`,
    expected: "NONE",
    description: "Clean code - proper debounce with context preservation",
  },
  {
    id: 50,
    code: `class EventEmitter {
  #listeners = new Map();

  on(event, callback) {
    if (!this.#listeners.has(event)) {
      this.#listeners.set(event, new Set());
    }
    this.#listeners.get(event).add(callback);
    return () => this.off(event, callback);
  }

  off(event, callback) {
    this.#listeners.get(event)?.delete(callback);
  }

  emit(event, ...args) {
    this.#listeners.get(event)?.forEach(cb => cb(...args));
  }
}`,
    expected: "NONE",
    description: "Clean code - well-structured event emitter with cleanup",
  },
];

export const CATEGORIES = [
  "BUG",
  "SECURITY",
  "STYLE",
  "PERFORMANCE",
  "NONE",
] as const;
export type Category = (typeof CATEGORIES)[number];
