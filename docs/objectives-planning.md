# Objectives — planning and execution

The archive's six images supply feature ideas. The existing shell, hierarchy, cards, buttons, drawers and calendar styling remain the design reference. **White / cream** is a global appearance choice in the sidebar and Settings.

## Reference coverage

| Reference | Implemented workflow |
| --- | --- |
| Weekly / Monthly overview | Five tabs and a searchable objective list showing color, horizon, priority and progress. |
| Hourly planning | Hourly week, flexible blocks, background calendar commitments, planned/actual work and the shared Performance focus target. Click a slot to open the existing block editor. |
| Monthly roadmap | Objectives × weeks with milestones, dated tasks, planned hours, progress and deadlines. Create milestones from week cells. |
| Hierarchy roadmap | Progress rolls up tasks and children at every level. Objective details expose summary, status, priority, next action, milestones, deliverables, assumptions and blocks. |
| Analytics | Expected/actual progress, velocity, momentum, forecast, slip, health, resource allocation, impact/effort, history, PERT and up to four recommendations. |
| Execution & Logging | Optional actual minutes; done/partial/not-done results; corrections; planned/actual comparison; impact review, replan and ignore. |

Details support creating/completing tasks, entering dated progress observations, and editing three-point estimates and dependencies. Parent filters include descendant blocks. Resource allocation counts each top-level project once.

Decision actions persist seven-day dismissal, a reduced effort estimate, reassignment of a planned block, and acceptance of the current forecast as the deadline. Recovery scheduling previews days, daily duration and total time before creating flexible blocks. Calendar days include weekends. Plans earn no capital until execution is logged.

## Metric rules

- Progress is 100 for DONE. Otherwise a manual value overrides the equal-weight mean of direct non-cancelled tasks and child objectives. Task DONE counts as 100 even if an old percentage was zero. Undated and out-of-week tasks contribute. Automatic 100% does not silently complete the objective or grant its completion reward.
- Task/objective mutations record today's checkpoint. Historical progress is not inferred from current state. Known past observations may be entered explicitly. Entering today's observation enables manual mode; clearing manual progress restores the rollup.
- Expected progress is linear between start and deadline, bounded to 0–100. The default start is creation date. Both assumptions can be edited. Without a deadline, no expected trajectory is shown.
- Velocity uses observed progress change per seven days, with a baseline at least seven days old and at most 28 days old. Momentum compares the preceding observed interval. Units are percentage points per week.
- Forecast uses remaining progress divided by positive velocity. Missing/nonpositive velocity does not produce a speculative finish date. Forecasts beyond ten years are omitted. Slip is forecast minus deadline in calendar days.
- The on-time simulation resamples observed consecutive-day progress changes in 400 deterministic scenarios. It requires seven daily changes within 28 days and a future deadline within a year. Already missed deadlines and recorded completions are assessed directly. The simulation assumes recent conditions continue; it is not a calibrated success probability.
- Health averages available deadline alignment (100 minus positive progress deficit) and the completion rate of explicitly logged blocks over 14 days. Missing components and unlogged blocks are excluded.
- PERT effort is `(optimistic + 4 × likely + pessimistic) / 6`, adjusted for unfinished task fraction. Existing task estimates are used before explicit three-point estimates are saved. A topological forward/backward pass calculates earliest starts, slack and critical tasks. Missing estimates are flagged and prevent critical-task classification. Dependency-chain effort is not a single-person calendar forecast.
- Recovery scenarios use progress deficit × estimated total effort, spread over up to seven remaining days. They are labeled assumptions, not guarantees. A missed block is never assigned a fabricated causal delay or turned into automatic debt.
- Reducing scope changes estimated effort, not progress. Deliverables remain editable through the existing task/objective flows.

## Storage and verification

Migration `20260913160000_objective_planning` adds `ObjectivePlan`, `ObjectiveProgressEntry`, `TaskPlan` and `BlockRecovery`, preserving existing data. Owner entities use cascading foreign keys. All reads and writes enforce authenticated ownership; dependency cycles and foreign-objective dependencies are rejected.

`GET /api/objectives/planning?month=YYYY-MM` returns the read model. Mutations use `/settings`, `/checkpoint`, `/task`, `/decision`, `/recovery`, `/recovery-schedule` and `/reallocate`. Next only proxies the API; business calculations live in Python. TypeScript parses API responses at the boundary.

Recovery retries do not duplicate blocks. Original execution remains intact. Automatic recovery rejects days exceeding 24 hours of planned blocks; it does not claim to optimize calendar conflicts or working hours.

Pure tests cover rollups, sparse histories, velocity, momentum, simulation and critical paths. Rollback-only PostgreSQL tests cover persistence, ownership, forecast acceptance, task integration, dependencies, recovery and the absence of rewards for planned work. Existing frontend domain tests, TypeScript checks and the production build also run.

## To-do integration

To-do opens on **Prepare my week**: a weekly objectives table, linked tasks with estimated working time, and an hourly calendar for placing the work across the seven days. Creating an objective uses the displayed week and its final day as the default target date. New tasks keep their objective link and duration; dragging or using the placement form persists their date and times. Day totals make the planned workload visible. The task list remains directly available.

Month overview, weekly review, search filters, assistant help and performance metrics are optional views or disclosures. The objective form starts with the desired result, timeframe and first action; hierarchy, status and other settings are optional details. The task editor similarly keeps scheduling and objective fields visible while grouping templates, tags and progress in more options. The review compares estimated, remaining and recorded work and suggests tasks to revisit. A scheduled task date is not treated as a deadline.

`POST /api/tasks/execution` records done/partial/not-done with optional actual minutes. Migration `20260913190000_task_execution` links recorded work to a task. One cumulative entry per task and work date is corrected on repeat submission; different work days retain separate entries. Entries feed the same Performance calculation and objective work history. Estimated minutes are never substituted for actual minutes. Nonproductive tasks do not earn work capital. Task deletion cascades to its work entries; cancellation excludes the task completion reward but does not erase past work.

The endpoint enforces task ownership, no future work, and the shared 24-hour daily maximum. The status saved through this drawer updates the task's current overall status; dates describe when the work happened. Correcting a past day's result therefore also updates current status. Existing quick status controls remain available without requiring time tracking. Tests cover corrections, independent days, optional time, ownership, daily limits, deletion and month boundaries.
