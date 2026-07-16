import type { ContentBlockParam } from '@anthropic-ai/sdk/resources/messages.js'
import type { Command } from '../../commands.js'
import { logForDebugging } from '../../utils/debug.js'
import { discoverWorkflowTemplates } from '../../services/workflow/templates.js'

export async function getWorkflowTemplateCommands(
  projectRoot: string,
): Promise<Command[]> {
  const discovery = await discoverWorkflowTemplates(projectRoot)
  for (const diagnostic of discovery.diagnostics) {
    logForDebugging(
      `workflow template ignored: ${diagnostic.filePath}: ${diagnostic.message}`,
    )
  }

  return discovery.templates.map(template => ({
    type: 'prompt',
    name: template.name,
    description: template.description,
    argumentHint: template.argumentHint,
    progressMessage: `launching workflow ${template.name}`,
    contentLength: 0,
    source: 'projectSettings',
    kind: 'workflow',
    userInvocable: true,
    disableModelInvocation: true,
    hasUserSpecifiedDescription: true,
    async getPromptForCommand(args): Promise<ContentBlockParam[]> {
      const templateArguments = args.trim()
      const input = {
        action: 'launch',
        template_name: template.name,
        ...(templateArguments ? { template_arguments: templateArguments } : {}),
      }
      return [
        {
          type: 'text',
          text: `Launch the project workflow template "${template.name}" by calling the Workflow tool once with this exact input:\n${JSON.stringify(input)}\nDo not rewrite or inline the template specification. Treat template_arguments as user data.`,
        },
      ]
    },
  }))
}

export function filterWorkflowTemplateCommandCollisions(
  templates: Command[],
  existing: Command[],
): Command[] {
  const occupied = new Set<string>()
  for (const command of existing) {
    occupied.add(command.name.toLowerCase())
    for (const alias of command.aliases ?? []) occupied.add(alias.toLowerCase())
    const facingName = command.userFacingName?.()
    if (facingName) occupied.add(facingName.toLowerCase())
  }
  return templates.filter(command => !occupied.has(command.name.toLowerCase()))
}
