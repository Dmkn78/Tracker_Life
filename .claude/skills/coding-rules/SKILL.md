---
description: Apply naming, typing, file-structure, constants, return, import, and duplication rules. Use when writing, editing, reviewing, refactoring, naming variables/functions/files/types, extracting constants, or creating new code.
---

# Coding Rules

## Purpose

Make code understandable for someone who does not know the project.
A name, file, type, constant, and return must reveal intent.

## Workflow

1. Locate the concerned code with grep/search/file search/semantic search.
2. Apply naming, file role, type, constant, return, import, and duplication rules.
3. Verify edited ranges and run targeted checks when available.
4. Apply the checklist before finishing.

## Naming

Names must describe the domain precisely.

Avoid vague names unless the scope is tiny and conventional:
`d`, `data`, `val`, `value`, `tmp`, `temp`, `res`, `result`, `item`, `obj`, `thing`, `stuff`, `handle`, `manage`, `process`, `helper`, `util`.

Short names are allowed only in obvious local contexts:
`i`, `j`, `k` in short loops; `x`, `y` in local math; `row`, `col` in matrix code; conventional low-level names when standard in the language.

Rules:
- Boolean names read like true/false statements: `isPresent`, `hasAccess`, `canRetry`, `shouldRender`, `wasLoaded`.
- Collections are plural: `users`, `parsedRows`, `activeOrders`.
- Derived variables say what changed: `normalizedEmail`, `parsedRequestBody`, `sortedTransactions`.
- Functions are verb phrases: `calculateDailyWorkload`, `parseInvoiceLine`, `validateUserInput`.
- Types/classes/structs/enums/interfaces are nouns: `UserProfile`, `PricingRequest`, `ValidationError`.
- Use complete, pronounceable, searchable names.
- Avoid unexplained abbreviations, glued initials, and exotic acronyms.

## No flag arguments

Do not use a boolean parameter that makes one function do two behaviors.

Bad:
`renderPanel(isClosed)`
`processOrder(order, true)`
`calculatePrice(input, includeTax)`

Good:
`renderClosedPanel()`
`renderOpenPanel()`
`archiveOrder(order)`
`submitOrder(order)`
`calculateTaxIncludedPrice(input)`
`calculatePreTaxPrice(input)`

## File role

One file has one primary role.
The filename must announce the role.
Split files that mix roles or grow into monoliths.

Common roles:
- domain/core: pure calculation, validation, parser, transformation, policy
- application/use-case: orchestration of a feature, command, job, or workflow
- adapter/boundary: HTTP, DB, filesystem, CLI input, env, subprocess, SDK, socket, queue
- presentation/interface: UI, CLI output, TUI view, route handler, page, template, notebook display
- types/schema: public contracts, DTOs, structs, protocols, schemas
- constants/config: thresholds, statuses, limits, paths, durations, labels
- tests: focused behavior or regression tests

Do not mix pure domain logic with UI, framework, network, database, filesystem, or environment code.
Prefer small targeted files with explicit imports over 1000-line files.
A reader should guess where to debug from the names.

## Types

Use explicit types on public function inputs, public returns, exported functions, boundary inputs/outputs, schemas, DTOs, props, structs, classes, and complex local structures.

Language guidance:
- TypeScript: avoid `any`; use `unknown` plus parsing/validation when runtime data is uncertain.
- Python: type public functions; prefer dataclass, TypedDict, Protocol, Enum, Literal, Pydantic/model schemas when useful.
- Rust: use `Result` and `Option`; avoid `unwrap`/`expect` in production core logic.
- C++: prefer explicit types, const correctness, RAII, smart pointers for ownership, and clear value objects.
- Go: use structs, explicit errors, and `context.Context` for cancellation/timeouts.
- Shell: use named variables, quoting, strict mode when safe, and small functions.

Impossible states should not be representable.
Prefer enums, discriminated unions, sealed classes, tagged structs, state machines, `Result`, or `Option` over contradictory booleans.

## Constants

Name meaningful literals:
business numbers, thresholds, durations, limits, statuses, route names, event names, repeated strings, and field lists.

Keep constants local if only local.
Move constants to a shared constants/config/domain file if reused.

Examples:
`DEFAULT_REQUEST_TIMEOUT_MS`
`MAX_RETRY_COUNT`
`WORKLOAD_EXHAUSTION_THRESHOLD`
`SUPPORTED_LOCALES`
`PRICE_DECIMAL_PLACES`

## Return rule

For non-trivial functions, return a named variable, not a raw expression.

Bad:
`return users.filter(user => user.isActive).map(user => user.email)`
`return price * (1 + taxRate)`

Good:
`const activeUserEmails = users.filter(user => user.isActive).map(user => user.email)`
`return activeUserEmails`

`const taxIncludedPrice = price * (1 + taxRate)`
`return taxIncludedPrice`

Small guard clauses may stay idiomatic:
`if not user: return None`
`if err != nil { return nil, err }`

## Vertical order

Use top-down reading order:
1. external imports
2. internal imports
3. public types, then private types
4. constants
5. primary export/public function/class/component/command
6. helpers called by the primary export
7. secondary exports

The main export reads like a summary.
Details live below or in imported files.

## Duplication

One value, formula, parser, type, constant, request field list, or business rule used in multiple places must have one source of truth.
Extract and import duplicated formulas, fetch/request logic, error mapping, validation, and domain conditions.
Respect documented repo exceptions, generated code, or intentionally independent parsers.

## Checklist

Before finishing:
- no vague names outside tiny scope
- booleans use `is`, `has`, `can`, `should`, `was`, `will`, or stack convention
- functions are verb phrases
- types/classes/structs are nouns
- names are complete, pronounceable, searchable
- no unexplained abbreviations
- no boolean flag argument for two behaviors
- one file has one role
- public inputs/returns are typed where supported
- no unsafe `any` or equivalent untyped escape hatch
- meaningful magic numbers/strings are constants
- final business return uses a named variable
- file order supports top-down reading
- shared concepts are imported, not duplicated
