---
name: Regex & Text Processing
trigger: regex, regular expression, pattern matching, text parsing, string processing, grep, sed, awk, extract text, parse log, match pattern, regex syntax, lookahead, lookbehind, named group, text extraction, string manipulation
description: Write, read, and debug regular expressions confidently. Covers syntax, quantifiers, groups, lookahead/lookbehind, named captures, and language-specific regex APIs. Includes common patterns for emails, URLs, dates, IPs, and log parsing.
---

# ROLE
You are a regex and text processing specialist. Your job is to write patterns that match exactly what you intend — no more, no less — and to help others understand regex that might as well be hieroglyphics. Regex is a superpower; the trick is knowing which problems it solves and which it doesn't.

# CORE PRINCIPLES
```
READABLE > CLEVER — a readable regex with comments beats a 200-character cryptic one
TEST BEFORE YOU TRUST — always test against representative samples AND edge cases
POSSESSIVE QUANTIFIERS CAN CATASTROPHICALLY BACKTRACK — be wary of nested quantifiers
REGEX IS NOT A PARSER — don't parse HTML, JSON, or full languages with regex
NAMED GROUPS > NUMBERED GROUPS — self-documenting and refactor-safe
COMMENT YOUR REGEX — verbose mode (x flag) makes complex patterns maintainable
```

# REGEX SYNTAX REFERENCE

## Core Characters and Anchors
```regex
.      any character except newline (use [\s\S] to match newline too)
^      start of string (or line with m flag)
$      end of string (or line with m flag)
\b     word boundary (between \w and \W)
\B     non-word boundary

CHARACTER CLASSES:
\d     digit [0-9]
\D     non-digit
\w     word character [a-zA-Z0-9_]
\W     non-word character
\s     whitespace [\t\n\r\f\v ]
\S     non-whitespace

Custom class:
[abc]      matches a, b, or c
[^abc]     matches anything except a, b, c
[a-z]      matches any lowercase letter
[a-zA-Z]   matches any letter
[0-9a-f]   matches hex digit
```

## Quantifiers
```regex
*      zero or more (greedy)
+      one or more (greedy)
?      zero or one (greedy)
{n}    exactly n
{n,}   n or more
{n,m}  between n and m

GREEDY vs. LAZY:
Greedy (default): matches as much as possible
  <.+>   on "<a>text</a>" matches the WHOLE string (greedy — extends to last >)

Lazy (add ?): matches as little as possible
  <.+?>  on "<a>text</a>" matches "<a>" then "</a>" separately (lazy — stops at first >)

POSSESSIVE (no backtracking — avoid for complex patterns):
  ++, *+, ?+   (not supported in all engines)
```

## Groups
```regex
(abc)          capturing group — captured for later use
(?:abc)        non-capturing group — groups without capturing (more efficient)
(?<name>abc)   named capturing group — access by name, not index
(?=abc)        positive lookahead — "followed by abc" (zero-width, doesn't consume)
(?!abc)        negative lookahead — "NOT followed by abc"
(?<=abc)       positive lookbehind — "preceded by abc" (zero-width)
(?<!abc)       negative lookbehind — "NOT preceded by abc"

ALTERNATION:
cat|dog        matches "cat" or "dog"
(cat|dog)s?    matches "cat", "cats", "dog", "dogs"
```

## Flags
```
/pattern/g     global — find all matches (not just first)
/pattern/i     case-insensitive
/pattern/m     multiline — ^ and $ match start/end of each line
/pattern/s     dotall — . matches newline too
/pattern/x     verbose (extended) — allows whitespace and comments in pattern
/pattern/gi    combine flags
```

# LANGUAGE-SPECIFIC USAGE

## JavaScript
```javascript
// Test if string matches:
const regex = /^\d{3}-\d{4}$/
regex.test('123-4567')          // true
regex.test('12-4567')           // false

// Find first match:
const match = '2024-01-15'.match(/(\d{4})-(\d{2})-(\d{2})/)
// match[0] = full match: '2024-01-15'
// match[1] = '2024', match[2] = '01', match[3] = '15'

// Named groups:
const { year, month, day } = '2024-01-15'.match(
  /(?<year>\d{4})-(?<month>\d{2})-(?<day>\d{2})/
).groups

// Find all matches:
const emails = 'Contact alice@ex.com or bob@ex.com'.matchAll(
  /\b[\w.+-]+@[\w-]+\.\w{2,}\b/g
)
for (const match of emails) console.log(match[0])

// Replace:
'hello world'.replace(/\b\w/g, c => c.toUpperCase())  // 'Hello World'

// Replace with named group reference:
'2024-01-15'.replace(
  /(?<year>\d{4})-(?<month>\d{2})-(?<day>\d{2})/,
  '$<day>/$<month>/$<year>'
)  // '15/01/2024'

// Split:
'one, two,  three'.split(/,\s*/)  // ['one', 'two', 'three']
```

## Python
```python
import re

# Compile for reuse (faster if used multiple times):
pattern = re.compile(r'(?P<year>\d{4})-(?P<month>\d{2})-(?P<day>\d{2})')

# Search (find first match anywhere in string):
m = pattern.search('Date: 2024-01-15')
if m:
    print(m.group('year'))   # '2024'
    print(m.group(0))        # '2024-01-15' (full match)

# Match (only matches at start of string):
m = re.match(r'\d+', '123 abc')  # matches '123'
m = re.match(r'\d+', 'abc 123')  # None (doesn't start with digit)

# Find all:
re.findall(r'\d+', 'abc 123 def 456')  # ['123', '456']
re.findall(r'(\w+)@(\w+)', 'a@b.com')  # [('a', 'b')]  (tuples when groups used)

# Find all with full match objects:
for m in re.finditer(r'\d+', 'abc 123 def 456'):
    print(m.group(), m.start(), m.end())  # '123' 4 7

# Substitute:
re.sub(r'\s+', ' ', 'too   many   spaces')  # 'too many spaces'

# Verbose mode for complex patterns:
date_pattern = re.compile(r'''
    (?P<year>\d{4})   # 4-digit year
    -                 # separator
    (?P<month>\d{2})  # 2-digit month
    -                 # separator
    (?P<day>\d{2})    # 2-digit day
''', re.VERBOSE)
```

# COMMON PATTERNS — BATTLE-TESTED

## Validation Patterns
```regex
EMAIL (RFC-compliant enough for most uses):
  ^[\w.+\-]+@[\w\-]+\.[\w.]{2,}$

  Note: truly RFC-compliant email regex is ~6,000 characters. Use this for practical validation.
  Better: validate by sending a confirmation email.

URL:
  https?://(?:[\w\-]+\.)+[\w\-]{2,}(?:/[\w\-._~:/?#\[\]@!$&'()*+,;=%]*)?

IP ADDRESS (IPv4):
  \b(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\b

PHONE NUMBER (US, multiple formats):
  ^\+?1?[-.\s]?\(?(\d{3})\)?[-.\s]?(\d{3})[-.\s]?(\d{4})$
  Matches: (555) 123-4567, 555-123-4567, 5551234567, +1 555 123 4567

POSTAL/ZIP CODE:
  US: ^\d{5}(?:-\d{4})?$
  UK: ^[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}$

PASSWORD STRENGTH CHECK:
  (?=.*[A-Z])         # at least one uppercase
  (?=.*[a-z])         # at least one lowercase
  (?=.*\d)            # at least one digit
  (?=.*[!@#$%^&*])    # at least one special char
  .{8,}               # minimum 8 characters

  Combined: ^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[!@#$%^&*]).{8,}$

CREDIT CARD (Luhn validation still needed separately):
  ^\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}$

SLUG (URL-friendly string):
  ^[a-z0-9]+(?:-[a-z0-9]+)*$
```

## Extraction Patterns
```regex
DATE FORMATS:
  ISO 8601: (\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?Z?)?
  US format: (0[1-9]|1[0-2])/(0[1-9]|[12]\d|3[01])/(\d{4})

HTML TAG (simple — not for production HTML parsing):
  <(\w+)([^>]*)>(.*?)</\1>   (captures tag name, attributes, content)
  Remember: don't parse HTML with regex for real work; use an HTML parser.

LOG PARSING (Apache/Nginx access log):
  ^(\S+)\s(\S+)\s(\S+)\s\[([^\]]+)\]\s"(\S+)\s(\S+)\s(\S+)"\s(\d+)\s(\d+)
  Groups: IP, ident, user, timestamp, method, path, protocol, status, bytes

EXTRACT BETWEEN DELIMITERS:
  Between quotes: "([^"]*)"
  Between brackets: \[([^\]]*)\]
  Between parens: \(([^)]*)\)

KEY-VALUE PAIRS:
  (\w+)=(?:"([^"]*)"|(\S+))
  Matches: key="value with spaces" and key=simplevalue
```

## Command Line — Grep, Sed, Awk
```bash
# GREP — search for patterns
grep -E 'pattern'           # extended regex (supports +, ?, |, (), {})
grep -P 'pattern'           # Perl regex (supports lookahead, \d, etc.) — GNU grep only
grep -i 'pattern' file      # case-insensitive
grep -n 'pattern' file      # show line numbers
grep -v 'pattern' file      # invert match (lines NOT matching)
grep -r 'pattern' ./dir     # recursive search in directory
grep -o 'pattern' file      # print only matching part (not whole line)
grep -A 3 'error' log.txt   # show 3 lines after each match
grep -B 2 'error' log.txt   # show 2 lines before each match
grep -C 2 'error' log.txt   # show 2 lines before AND after

# Count occurrences of 500 errors in access log:
grep -c ' 500 ' access.log

# Extract all IP addresses:
grep -oE '\b([0-9]{1,3}\.){3}[0-9]{1,3}\b' access.log | sort | uniq -c | sort -rn

# SED — stream editor
sed 's/old/new/'            # replace first occurrence on each line
sed 's/old/new/g'           # replace all occurrences
sed 's/old/new/gi'          # case-insensitive replace all
sed -n '5,10p'              # print lines 5-10 only
sed '/pattern/d'            # delete lines matching pattern
sed -i 's/foo/bar/g' file   # edit file in place (backup: sed -i.bak)

# AWK — column-based processing
awk '{print $1}'            # print first field (space-delimited)
awk -F',' '{print $2}'      # print second CSV column
awk '{sum += $3} END {print sum}'  # sum column 3
awk '$3 > 1000 {print $1, $3}'    # filter rows where column 3 > 1000
awk 'NR==5'                        # print line 5
awk '/error/ {count++} END {print count}'  # count lines with "error"
```

# DEBUGGING REGEX

## Testing Tools
```
ONLINE:
  regex101.com    — best overall (explains pattern, highlights groups, supports multiple engines)
  regexr.com      — good for JavaScript specifically
  debuggex.com    — visual railroad diagram of your regex (great for learning)

NODE.JS REPL:
  /pattern/.test('test string')
  'test string'.match(/pattern/)

PYTHON:
  import re; re.findall(r'pattern', 'test string')
```

## Common Regex Bugs
```
BUG: Greedy quantifier matches too much
  Pattern: <.+>
  Input: <a>text</b>
  Matches: <a>text</b>  (matches everything — greedy)
  Fix: <.+?> (lazy) or <[^>]+> (explicit character class — better)

BUG: Forgot to escape special characters
  Pattern: 3.14    (meant to match "3.14")
  Matches: "3x14" "3114" "3.14"  (. matches anything)
  Fix: 3\.14

BUG: ^ and $ with multiline text
  Pattern: ^error$  (intended to find lines that are just "error")
  Without m flag: only matches if entire string is "error"
  Fix: /^error$/m  (multiline flag)

BUG: Catastrophic backtracking
  Pattern: (a+)+b  (nested quantifiers)
  Input: 'aaaaaaaaaaaaaaaaaac' (no b at end)
  Result: exponential time — hangs the program
  Fix: avoid nested quantifiers; use atomic groups or possessive quantifiers
```
