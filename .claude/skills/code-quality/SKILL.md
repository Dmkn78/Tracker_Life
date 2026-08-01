---
description: Apply code quality and architecture rules: abstraction, function size, parameters, duplication, comments, mutation, layers, async/API safety, errors, i18n, file patterns, review, and refactoring. Use when implementing features, fixing bugs, refactoring, reviewing, or creating code.
---

# Code Quality

## Purpose

Write code that is readable, testable, maintainable, and easy to debug.
Prefer clarity over cleverness.
Write like a competent human, not like compressed AI output.

## Core rules

- Function length target: max 40 lines.
- One function = one abstraction level.
- One file = one primary role.
- Domain/core logic must be pure when possible.
- External boundaries must be isolated.
- Prefer explicit intermediate variables over dense nested expressions.
- Prefer named concepts over anonymous transformations.
- Prefer imports and decomposition over monolith files.
- Do not micro-optimize unless performance is explicitly required or measured.

## Workflow

1. Sketch the behavior flow mentally before editing.
2. Put each responsibility in the right layer.
3. Keep functions small and readable top-down.
4. Extract pure logic into domain/core files.
5. Keep boundaries explicit.
6. Add timeout, cancellation, batching, and error context where relevant.
7. Verify with targeted checks.

## Function abstraction

A function should either orchestrate named helpers or perform detailed logic, not both.
The primary function should read like a summary.

Split when:
- the extracted name clarifies a decision
- a part can be tested alone
- a detail changes for a different reason
- a calculation, parser, validation, branch, or policy has domain meaning

Do not split blindly just to satisfy line count.
Split only when the name and boundary improve comprehension.

## Parameters

When several primitive values form a concept, pass an object/struct/dataclass/record/config/domain object.

Bad:
`calculatePrice(amount, rate, currency, date, includeFees)`

Good:
`calculatePrice(pricingRequest)`

Do not create a global type for every pair of values.
Create a type when it is a real concept, reused, tested, or clearer at call sites.

## Duplication

Track more than copy-paste:
- repeated formulas
- validation conditions
- parsers
- request fields
- API calls
- DB query shapes
- error mapping
- similar types for one flow
- repeated status or state conditions
- repeated UI labels or user-visible strings

Extract to a domain helper, shared constant, schema, adapter, or use-case file.
Do not extract generated code or intentionally independent duplicated parsers without reason.

## No opaque wrappers

Avoid catch-all wrappers or dumping grounds:
`manager`, `processor`, `handler`, `helper`, `utils`, `service` with no domain meaning.

A function must say the domain action:
`calculateDailyWorkload`
`parseImportedTransactions`
`fetchUserProfileWithTimeout`

## Comments

Comments explain why, not obvious what.

Good comments explain:
- external constraint
- fragile rule
- formula source
- risk avoided
- compatibility issue
- non-obvious tradeoff

Do not narrate clear code.
For formulas, add a short comment explaining the domain reason or source.
Prefer clear names and structure over descriptive comments.

## Mutation

Prefer transformations returning new values.
Do not mutate input parameters in domain/core logic.
If mutation is needed for performance or API constraints, isolate it at a boundary and name it clearly.
Use language idioms without hiding ownership or side effects.

## Layers

Adapt this model to the actual stack.

### Domain/core
Pure rules, calculations, validation, policies, parsers, transformations.
No UI, HTTP, DB, filesystem, env, framework, or SDK calls.
Directly testable.

### Application/use-case
Orchestrates a user action, command, workflow, job, or feature.
Calls domain and boundaries.
Keeps behavior flow readable.

### Boundary/adapter/infrastructure
HTTP, DB, filesystem, env, SDKs, CLI input, subprocesses, browser APIs, OS APIs, queues.
Converts external data into internal types.
Applies timeout, cancellation, retry, and error mapping.

### Presentation/interface
UI, CLI output, TUI view, route handler, page, screen, template, notebook display.
Receives data ready to display or return.
No business calculations.
No raw backend URLs, SQL, raw JSON parsing, or environment details unless this file is explicitly a boundary.

### Tests
Focused tests for domain rules, use cases, adapters, and regressions.

## Dependency direction

Dependencies point inward toward stable concepts.

- Domain/core depends on nothing above it.
- Application/use-case depends on domain and boundary contracts.
- Adapters implement external details.
- Presentation calls application/use-case, not low-level clients directly unless the project is intentionally tiny.

Violations to correct:
- domain importing UI/framework/HTTP/DB
- UI building backend payloads everywhere
- DTOs leaking through all layers
- presentation doing raw parsing or formulas
- low-level client depending on page/component code

For small scripts, still separate input parsing, domain calculation, and output/side effects.

## File patterns

### Domain files
Pure logic only.
Explicit inputs/outputs.
No side effects.
No env/network/UI/database.
No input mutation.
Filename says what it calculates, validates, parses, or decides.

### Application/use-case files
Orchestrate a feature.
Show steps in order.
Delegate formulas, parsing, validation, and external calls.

### Adapter/API/boundary files
Contain protocol and external-system details.
Keep DTOs, SQL, SDK calls, env variables, paths, and subprocesses here.
Transform external errors into contextual application errors.
Use shared schemas, constants, and mappers.

### State/orchestration files
Make impossible states impossible.
Use enums/discriminated unions/state machines over contradictory booleans.
Expose actions named by domain intent.
Delegate pure calculation to domain.
Return the minimum needed by presentation.

### Presentation/interface files
Receive ready-to-display data.
Keep branches simple.
No business formulas.
No raw backend URLs.
No DTO leakage when avoidable.
Split large sections into focused views/components/commands/templates.

## i18n

Apply only when the software has user-visible strings and a localization system.
No hardcoded visible text in presentation when i18n exists.
Use existing translation helpers and key conventions.
Add new keys in required locales, especially English and French when supported.
Do not invent i18n infrastructure for backend-only code, libraries, numeric code, internal scripts, Vim config, or core algorithms with no user-visible product strings.

## External calls and async safety

For any external call, prefer:
- one grouped request instead of N repeated requests when possible
- shared field lists, schemas, query builders, and request helpers
- timeout/deadline
- cancellation/lifecycle cleanup when relevant
- contextual errors
- no infinite wait
- no hidden background task that outlives its owner unintentionally

Translate by stack:
- browser/TypeScript: AbortController or equivalent cleanup
- Node: AbortSignal, timeout, request lifecycle, shutdown handling
- Python: timeout args, asyncio cancellation, context managers, requests/httpx timeouts
- Go: context.Context with deadline/cancel
- Rust: timeout future, cancellation-safe async, RAII cleanup
- C++: RAII, stop_token, future/socket timeout, explicit lifecycle owner
- Shell: `timeout` or bounded subprocess when appropriate

## Error handling

Do not hide failure as `-1`, `false`, `null`, empty string, or empty list.
Use exceptions, Result, Either, typed errors, or explicit error objects according to language convention.
Always include context:
- operation
- value or identifier
- violated constraint
- external system or file

Keep try/catch or error branches focused.
A try/catch block should do one thing.
Do not pass null intentionally.
Represent absence explicitly with Option/Maybe, optional parameter, union, nullable boundary type handled immediately, or equivalent.

## Testing and verification

Prefer targeted checks:
- test changed behavior
- typecheck changed area
- lint edited files
- build only when needed
- execute minimal reproduction when useful

Add/update tests for:
- bug fixes
- business rule changes
- parsers/validators
- fragile formulas
- refactors with behavior risk

If tests are unavailable, verify by readback and local consistency.

## Checklist

Before finishing:
- functions are <= 40 lines unless justified
- one abstraction level per function
- main function reads top-down
- parameters grouped when they form a concept
- no duplicated formula, request, parser, error mapper, field list, or business condition
- no opaque generic wrapper
- comments justify why, not obvious what
- no hidden mutation of domain inputs
- each file has one role
- domain/core is pure
- external boundaries are isolated
- dependencies do not point upward
- presentation has no business calculations
- i18n respected only when relevant
- external calls have batching, timeout, and cancellation where relevant
- errors are contextual, not magic values
- no deliberate null passing
- final business returns use named variables
- edited files were read back or checked
