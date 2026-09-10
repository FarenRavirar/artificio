---
name: ast-grep
description: Busca, lint e reescrita de código por AST com ast-grep — sintaxe de padrão, meta-variáveis, configuração de regra e comandos de CLI. Use quando pedirem busca estrutural (não textual), refatoração por padrão em vários arquivos, ou regra de lint própria; e quando `rtk rg` não basta porque o que se procura é forma de código, não texto. Stack deste repo: TypeScript/TSX, JavaScript, SQL, Python.
---

# ast-grep Skill

You now have access to ast-grep, a powerful AST-based code search, lint, and rewrite tool. Use this skill when working with code analysis, refactoring, or pattern matching tasks.

## What is ast-grep?

ast-grep is a command-line tool that searches, lints, and rewrites code using Abstract Syntax Trees (ASTs) rather than plain text. Think of it as "a hybrid of grep, eslint, and codemod."

**Key advantages over text-based tools:**
- Structurally aware: matches code patterns, not just text
- Language-aware: understands syntax across 20+ languages
- Precise: avoids false positives from string/comment matches
- Fast: written in Rust with multi-core support

**Supported languages:** C, C++, Rust, Go, Java, Python, C#, JavaScript, TypeScript, HTML, CSS, Kotlin, Swift, JSON, YAML, and more.

## Core Commands

### 1. ast-grep run (Quick searches & rewrites)
```bash
# Basic pattern search (JavaScript)
ast-grep run -p 'console.log($MSG)' -l javascript

# Basic pattern search (TypeScript)
ast-grep run -p 'useEffect($FN, [])' -l tsx

# Search and rewrite (JavaScript)
ast-grep run -p 'var $VAR = $VAL' -r 'let $VAR = $VAL' -l javascript

# Search and rewrite (TypeScript)
ast-grep run -p 'const $V = await $P.json()' -r 'const $V: unknown = await $P.json()' -l ts

# Apply all changes (use after user approval)
ast-grep run -p 'PATTERN' -r 'REWRITE' -U

# Get JSON output for analysis
ast-grep run -p 'PATTERN' --json

# From stdin
echo "var x = 1" | ast-grep run --stdin -l javascript -p 'var $V = $VAL'
```

### 2. ast-grep scan (Rule-based linting)
```bash
# Scan with all rules in project
ast-grep scan

# Use specific rule file
ast-grep scan -r path/to/rule.yml

# Filter rules by regex
ast-grep scan --filter 'no-console'

# Inline rule
ast-grep scan --inline-rules 'id: test
language: JavaScript
rule:
  pattern: console.log($A)'
```

### 3. ast-grep test (Validate rules)
```bash
# Run tests for rules
ast-grep test

# Update all snapshots
ast-grep test -U
```

### 4. ast-grep new (Generate templates)
```bash
# Create new project structure
ast-grep new project

# Create new rule
ast-grep new rule my-rule

# Create new test
ast-grep new test my-test
```

## Pattern Syntax

### Meta Variables
Meta variables capture AST nodes and enable flexible pattern matching:

**Format:** `$` + uppercase letters/underscores/digits
- Valid: `$VAR`, `$META_1`, `$_TEMP`, `$A`
- Invalid: `$invalid`, `$camelCase`, `$123`

**Usage:**
```javascript
// JavaScript Pattern: $OBJ.$METHOD($$$ARGS)
// Matches: user.save(data)
//          api.call(x, y, z)
//          obj.method()
```

```java
// Java Pattern: $OBJ.$METHOD($$$ARGS)
// Matches: user.getName()
//          list.add(item)
//          stream.collect(Collectors.toList())
```

**Capturing constraints:** Reusing the same variable name ensures matched code is identical:
```javascript
// Pattern: $X == $X
// Matches: a == a ✓
// Doesn't match: a == b ✗
```

**Non-capturing variables:** Prefix with `_` to match without capturing (performance optimization):
```javascript
// Pattern: $_OBJ.method()
// Matches method calls on any object without storing the object
```

### Multi-Node Matching
Use `$$$` to match zero or more AST nodes:

```javascript
// Pattern: function $FUNC($$$PARAMS) { $$$ }
// Matches any function with any number of parameters
```

**Named multi-node:**
```javascript
// Pattern: someFunc($$$ARGS)
// Captures all arguments as $$$ARGS
```

### Pattern Types

**1. Code Patterns** (most common)
```yaml
pattern: console.log($MSG)
```

**2. Kind Patterns** (match node types)
```yaml
kind: function_declaration
```

**3. Regex Patterns**
```yaml
regex: "^test_.*"
```

## Rule Configuration

Rules are written in YAML with three essential fields:

```yaml
id: unique-rule-identifier        # Required
language: JavaScript               # Required: determines which files to scan
rule:                             # Required: matching logic
  pattern: console.log($A)
```

### Rule Categories

**1. Atomic Rules** - Match single node properties
```yaml
rule:
  pattern: Promise.all($PROMISES)
```

**2. Relational Rules** - Match node relationships
```yaml
rule:
  pattern: await $EXPR
  inside:
    kind: function_declaration     # Not inside async function
    not:
      has:
        kind: async
```

**3. Composite Rules** - Combine multiple rules
```yaml
rule:
  all:                             # All conditions must match
    - pattern: $VAR = $VAL
    - not:
        inside:
          kind: function_declaration
  any:                             # At least one must match
    - pattern: var $V
    - pattern: let $V
```

### Rule Object Fields

| Field | Category | Purpose |
|-------|----------|---------|
| `pattern` | Atomic | Match code patterns |
| `kind` | Atomic | Match AST node types |
| `regex` | Atomic | Match with regex |
| `inside` | Relational | Node must be inside matched pattern |
| `has` | Relational | Node must contain matched pattern |
| `follows` | Relational | Node must come after pattern |
| `precedes` | Relational | Node must come before pattern |
| `all` | Composite | All sub-rules must match (AND) |
| `any` | Composite | At least one sub-rule must match (OR) |
| `not` | Composite | Pattern must NOT match |
| `matches` | Utility | Reference other rules by ID |

### Advanced Rule Example
```yaml
id: no-await-in-promise-all
language: TypeScript
message: Avoid await inside Promise.all
note: Use Promise.all to parallelize async operations
severity: warning
rule:
  pattern: Promise.all($PROMISES)
  has:
    pattern: await $_
    stopBy: end                    # Stop searching at expression boundaries
fix: |
  Remove await from $PROMISES
```

## Using ast-grep with Claude Code

**IMPORTANT:** This skill is designed for Claude Code's programmatic usage. Claude cannot use interactive mode.

### Recommended Workflow

When using ast-grep through Claude Code, follow this pattern:

**1. Search and Analyze**
```bash
# Use --json to get structured output for analysis
ast-grep run -p 'console.log($A)' -l javascript --json
```

**2. Present Findings to User**
Claude should review the JSON output and present findings to the user with:
- What was found
- Locations (file paths and line numbers)
- Proposed changes (if applicable)

**3. Apply Changes (Only After User Approval)**
```bash
# Use -U to apply all changes automatically
ast-grep run -p 'console.log($A)' -r 'logger.info($A)' -l javascript -U
```

**DO NOT use `--interactive` flag** - it requires human input and will fail in Claude Code.

### Example Claude Code Workflow

```bash
# Step 1: Find all matches
ast-grep run -p 'var $VAR = $VAL' -l javascript --json

# Claude analyzes JSON, shows user: "Found 15 var declarations in 8 files"
# User says: "Please update them to let"

# Step 2: Apply changes with user approval
ast-grep run -p 'var $VAR = $VAL' -r 'let $VAR = $VAL' -l javascript -U
```

## Best Practices

### 1. Always Use --json for Analysis
```bash
# Get structured output for Claude to parse
ast-grep run -p 'console.log($A)' -l javascript --json
ast-grep scan --json
```

### 2. Use the Right Tool for the Job
- **Quick one-off searches:** `ast-grep run` with `--json`
- **Recurring checks:** `ast-grep scan` with rules
- **Code refactoring:** `ast-grep run` with `--rewrite` and `-U` (after user approval)
- **CI/CD integration:** `ast-grep scan` with JSON output

### 3. Leverage Relational Rules
Instead of complex regex, use AST relationships:
```yaml
# Find console.log NOT inside try-catch
rule:
  pattern: console.log($A)
  not:
    inside:
      pattern: try { $$$ } catch ($E) { $$$ }
```

### 4. Test Rules Before Deploying
Always create tests for your rules:
```yaml
# In rule-test.yml
id: no-console-log
testCases:
  - id: should-match
    match: console.log("test")
  - id: should-not-match
    match: logger.info("test")
```

Run: `ast-grep test`

### 5. Understand Language-Specific Patterns
Patterns must be valid code in the target language:
```yaml
# JavaScript: snake_case and camelCase are different
pattern: my_function()  # Won't match myFunction()

# Python: indentation matters for blocks
pattern: |
  if $COND:
      $BODY
```

## Common Pitfalls & Solutions

### Pitfall 1: Invalid Meta Variable Names
```bash
# ❌ Wrong: lowercase letters
pattern: $myVar = $value

# ✓ Correct: uppercase only
pattern: $MY_VAR = $VALUE
```

### Pitfall 2: Language Mismatch
```bash
# ❌ Wrong: using Python syntax for JavaScript
ast-grep run -p 'print($A)' -l javascript

# ✓ Correct: use console.log for JavaScript
ast-grep run -p 'console.log($A)' -l javascript
```

### Pitfall 3: Forgetting --lang with stdin
```bash
# ❌ Wrong: ast-grep can't infer language
echo "code" | ast-grep run -p 'pattern'

# ✓ Correct: specify language
echo "code" | ast-grep run -p 'pattern' --stdin -l python
```

### Pitfall 4: Overly Broad Patterns
```yaml
# ❌ Too broad: matches everything
pattern: $A

# ✓ Specific: matches the structure you want
pattern: if ($COND) { $BODY }
```

### Pitfall 5: Not Using stopBy in Relational Rules
```yaml
# Without stopBy, search is unlimited (slow & imprecise)
rule:
  pattern: Promise.all($A)
  has:
    pattern: await $_
    stopBy: end  # Stop at expression boundaries for performance
```

## Useful Flags

| Flag | Purpose | Example | Claude Code Usage |
|------|---------|---------|-------------------|
| `-p, --pattern` | Search pattern | `-p 'console.log($A)'` | ✓ Use |
| `-r, --rewrite` | Replacement code | `-r 'logger.info($A)'` | ✓ Use |
| `-l, --lang` | Specify language | `-l javascript` | ✓ Use |
| `--json` | Machine-readable output | `--json` | ✓ **Always use** for analysis |
| `-U, --update-all` | Apply all changes | `-U` | ✓ Use after user approval |
| `--stdin` | Read from stdin | `--stdin` | ✓ Use when needed |
| `--debug-query` | Debug pattern matching | `--debug-query` | ✓ Use for troubleshooting |
| `-j, --threads` | Control parallelization | `-j 4` | ✓ Use |
| `-i, --interactive` | Manual review of each change | `--interactive` | ✗ **DO NOT USE** - requires human input |

## Integration Examples

### With jq (JSON processing)
```bash
ast-grep scan --json | jq '.[] | select(.severity == "error")'
```

### With git (changed files only)
```bash
git diff --name-only | xargs ast-grep run -p 'pattern'
```

### CI/CD Integration
```bash
# Exit with error if issues found
ast-grep scan --json > results.json
if [ $(jq length results.json) -gt 0 ]; then
  exit 1
fi
```

## When to Use ast-grep

**✓ Use ast-grep for:**
- Code refactoring across multiple files
- Finding complex code patterns (nested structures, specific contexts)
- Enforcing code standards (custom linting rules)
- Language-aware code search
- Safe automated code transformations

**✗ Don't use ast-grep for:**
- Simple string searches (use grep/ripgrep)
- Comment/documentation searches
- Binary file searches
- When exact character positions matter more than syntax

## Quick Reference

```bash
# Search for a pattern
ast-grep run -p 'PATTERN' -l LANG [FILES]

# Search and replace
ast-grep run -p 'PATTERN' -r 'REPLACEMENT' -l LANG

# Scan with rules
ast-grep scan [--rule RULE_FILE]

# Test rules
ast-grep test

# Generate completions
ast-grep completions bash > ~/.bash_completion.d/ast-grep
```

## Additional Resources

- Online Playground: https://ast-grep.github.io/playground.html
- Documentation: https://ast-grep.github.io/
- Pattern Catalog: Explore pre-built patterns for common tasks
- Language Reference: Check language-specific node types and syntax

## Workflow for Complex Refactoring (Claude Code)

1. **Explore:** Use `ast-grep run -p 'pattern' --json` to find all matches
2. **Analyze:** Parse JSON output and present findings to user
3. **Test:** Create a rule with tests: `ast-grep new rule my-rule`
4. **Apply:** After user approval, use `-U` to apply all changes
5. **Validate:** Run tests and build to ensure correctness

Remember: ast-grep operates on AST structure, not text. Always think in terms of code syntax, not string patterns.
