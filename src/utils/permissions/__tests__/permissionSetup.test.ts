import { expect, test } from 'bun:test'
import { getEmptyToolPermissionContext } from '../../../Tool.js'
import { AGENT_TOOL_NAME, LEGACY_AGENT_TOOL_NAME } from '../../../tools/AgentTool/constants.js'
import { BASH_TOOL_NAME } from '../../../tools/BashTool/toolName.js'
import { POWERSHELL_TOOL_NAME } from '../../../tools/PowerShellTool/toolName.js'
import {
  findDangerousClassifierPermissions,
  restoreDangerousPermissions,
  stripDangerousPermissionsForAutoMode,
} from '../permissionSetup.js'
import { permissionRuleValueFromString, permissionRuleValueToString } from '../permissionRuleParser.js'

function roundTrip(rule: string): string {
  return permissionRuleValueToString(permissionRuleValueFromString(rule))
}

test('stripDangerousPermissionsForAutoMode removes dangerous editable rules and restoreDangerousPermissions adds them back', () => {
  const bashRule = `${BASH_TOOL_NAME}(python:*)`
  const powerShellRule = `${POWERSHELL_TOOL_NAME}(Invoke-Expression:*)`
  const agentRule = `${AGENT_TOOL_NAME}(*)`

  const context = {
    ...getEmptyToolPermissionContext(),
    alwaysAllowRules: {
      userSettings: [bashRule, 'Read'],
      localSettings: [powerShellRule],
      session: [agentRule],
      command: [`${BASH_TOOL_NAME}(git status:*)`],
    },
  }

  const stripped = stripDangerousPermissionsForAutoMode(context)

  expect(stripped.alwaysAllowRules.userSettings).toEqual(['Read'])
  expect(stripped.alwaysAllowRules.localSettings).toEqual([])
  expect(stripped.alwaysAllowRules.session).toEqual([])
  expect(stripped.alwaysAllowRules.command).toEqual([`${BASH_TOOL_NAME}(git status:*)`])
  expect(stripped.strippedDangerousRules).toEqual({
    userSettings: [roundTrip(bashRule)],
    localSettings: [roundTrip(powerShellRule)],
    session: [roundTrip(agentRule)],
  })

  const restored = restoreDangerousPermissions(stripped)

  expect(restored.alwaysAllowRules.userSettings).toEqual([roundTrip('Read'), roundTrip(bashRule)])
  expect(restored.alwaysAllowRules.localSettings).toEqual([roundTrip(powerShellRule)])
  expect(restored.alwaysAllowRules.session).toEqual([roundTrip(agentRule)])
  expect(restored.alwaysAllowRules.command).toEqual([`${BASH_TOOL_NAME}(git status:*)`])
  expect(restored.strippedDangerousRules).toBeUndefined()
})

test('findDangerousClassifierPermissions reports settings and legacy cli task rules', () => {
  const dangerous = findDangerousClassifierPermissions(
    [
      {
        source: 'projectSettings',
        ruleBehavior: 'allow',
        ruleValue: permissionRuleValueFromString(`${POWERSHELL_TOOL_NAME}(Start-Process:*)`),
      },
    ],
    [`${LEGACY_AGENT_TOOL_NAME}(reviewer)`, `${BASH_TOOL_NAME}(git status:*)`],
  )

  expect(dangerous).toHaveLength(2)
  expect(
    dangerous.map(rule => ({
      source: rule.source,
      display: rule.ruleDisplay,
      sourceDisplay: rule.sourceDisplay,
    })),
  ).toEqual([
    expect.objectContaining({
      source: 'projectSettings',
      display: `${POWERSHELL_TOOL_NAME}(Start-Process:*)`,
    }),
    {
      source: 'cliArg',
      display: `${LEGACY_AGENT_TOOL_NAME}(reviewer)`,
      sourceDisplay: '--allowed-tools',
    },
  ])
})
