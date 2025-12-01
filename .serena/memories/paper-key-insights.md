# MAKER Paper - Key Insights for Implementation

## Paper Reference
**Title**: "Solving a Million-Step LLM Task with Zero Errors"
**Authors**: Meyerson et al. (Cognizant AI Lab, UT Austin)
**arXiv**: 2511.09030v1 (November 2025)

---

## Core Algorithms

### Algorithm 1: generate_solution
```
Input: x₀ (initial state), M (model), k (vote threshold)
for each step:
    a, x = do_voting(x, M, k)
    append a to actions
return actions
```

### Algorithm 2: do_voting (First-to-ahead-by-k)
```
V = {} (vote counts)
while True:
    y = get_vote(x, M)
    V[y] += 1
    if V[y] >= k + max(V[others]):
        return y
```

### Algorithm 3: get_vote (with Red-flagging)
```
while True:
    r = sample from M(prompt(x))
    if r has no red flags:
        return parse_action(r), parse_state(r)
```

---

## Key Equations

### Equation 9 - Voting Success Probability
```
p(correct) = p^k / (p^k + (1-p)^k)
```
Where p = per-step success rate, k = vote threshold

### Equation 13 - Full Task Success
```
p_full = (1 + ((1-p)/p)^k)^(-s/m)
```
For MAD (m=1): `p_full = (1 + ((1-p)/p)^k)^(-s)`

### Equation 14 - Minimum k for Target Reliability
```
k_min = ceil(ln(t^(-m/s) - 1) / ln((1-p)/p))
```
Where t = target reliability (e.g., 0.95)

### Equation 18 - Expected Cost (MAD)
```
E[cost] = Θ(s ln s)
```
Log-linear scaling - this is why it works!

---

## Experimental Findings

### Model Selection
- **gpt-4.1-mini** was most cost-effective
- Reasoning models (o3-mini) NOT required
- Small non-reasoning models suffice for MDAP

### Optimal Parameters (20-disk Towers of Hanoi)
- k = 3 (sufficient for 1M+ steps)
- Temperature = 0.1
- Max tokens = 750 (red-flag threshold)

### Red-Flag Impact
- Error rate increases sharply when response > ~700 tokens
- Format errors correlate with reasoning errors
- Red-flagging crucial for reducing correlated errors

---

## Practical Takeaways for SDK

1. **k=3 is a good default** - sufficient for most tasks
2. **750 token limit** - good default for tooLong red flag
3. **Temperature 0.1** - low temp for voting consistency
4. **Parallel sampling** - can parallelize up to k samples
5. **Cost estimation first** - validate before expensive runs
6. **Exact match voting** - simpler than semantic (works well)
