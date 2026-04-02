# Command And Tool Audit

This file records the currently verified high-value command and tool paths.

## Verified Commands

### CLI and headless

- `recode --help`
- `recode --version`
- `recode -p "<prompt>"`
- `recode -p "/help"`
- `recode -p "/status"`
- `recode -p "/doctor"`
- `recode -p "/files"`
- `recode -p "/diff"`
- `recode -p "/tasks"`
- `recode -p "/model-map help"`
- `recode -p "/model-map status"`
- `recode -p "/config"` returns a non-interactive guidance message
- `recode -p "/model"` returns a non-interactive guidance message

### Management surfaces

- `recode auth status`
- `recode agents`
- `recode mcp --help`
- `recode mcp list`
- `recode plugin list`

### Interactive commands worth trying

- `/model`
- `/model-map`
- `/status`
- `/doctor`
- `/mcp`
- `/plugin`
- `/tasks`
- `/commit`
- `/commit-push-pr`

## Verified recode-Specific Feature

### `/model-map`

The current tested flow is:

1. start `/model-map`
2. choose the model for `Opus`
3. choose the thinking level for `Opus`
4. repeat for `Sonnet`
5. repeat for `Haiku`
6. save all mappings together

Example saved result:

- `Opus -> gpt-5.4 (high)`
- `Sonnet -> gpt-5.4 (medium)`
- `Haiku -> gpt-5.4-mini (minimal)`

## Notes

- Not every command in `src/commands/*` is fully audited yet.
- The commands listed above are the ones explicitly validated during the current rebuild loop.
- `LSP` is now always registered in the base tool pool and relies on runtime connectivity instead of an extra external env gate.
- Interactive-only built-in commands no longer fall through to the misleading `Unknown skill` message in headless mode.
- Built-in `/commit` and `/commit-push-pr` are back in the command registry; they were previously missing from the assembled command list even though their source files existed.
- LSP manager initialization currently returns `success` with `0` discovered servers in this runtime, so the next step is configuration discovery rather than more registration work.
