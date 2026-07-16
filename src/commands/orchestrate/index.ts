import type { ContentBlockParam } from '@anthropic-ai/sdk/resources/messages.js'
import type { Command } from '../../commands.js'
import { ORCHESTRATE_PROMPT } from '../../services/workflow/prompts.js'

const orchestrate: Command = {
  type: 'prompt',
  name: 'orchestrate',
  description: 'Run a bounded multi-agent workflow for an explicit objective',
  progressMessage: 'designing workflow',
  contentLength: 0,
  source: 'builtin',
  async getPromptForCommand(args): Promise<ContentBlockParam[]> {
    const objective = args.trim()
      ? `\nUser objective:\n${args.trim()}\n`
      : '\nNo objective was provided. Ask the user for the workflow objective before launching anything.\n'
    return [{ type: 'text', text: `${ORCHESTRATE_PROMPT}${objective}` }]
  },
}

export default orchestrate
