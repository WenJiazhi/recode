export const DESCRIPTION =
  'Read the active Goal, save a milestone checkpoint, or report a verified terminal state.'

export const PROMPT = `Use this tool only when a persistent Goal is active.

Actions:
- get: read objective, status, token usage, elapsed time, and latest checkpoint.
- checkpoint: save a concise milestone summary after meaningful progress.
- update: report complete or blocked.

Before complete, audit every requirement against authoritative evidence. Do not reduce the original scope or infer success from missing failures.

Before blocked, the same genuinely insurmountable condition must have persisted across at least three continuation attempts. Difficulty, slow work, and partial progress are not blockers.

Only the user can pause, resume, replace, budget, or clear a Goal through /goal.`
