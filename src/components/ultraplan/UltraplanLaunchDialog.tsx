import * as React from 'react'
import { Box, Text, Link } from '../../ink.js'
import { Select } from '../CustomSelect/select.js'
import { PermissionDialog } from '../permissions/PermissionDialog.js'
import { useAppState, useSetAppState } from '../../state/AppState.js'
import { getGlobalConfig, saveGlobalConfig } from '../../utils/config.js'
import { CCR_TERMS_URL } from '../../commands/ultraplan.js'

type ChoiceValue = 'run' | 'cancel'

interface UltraplanLaunchDialogProps {
  onChoice: (
    choice: ChoiceValue,
    opts: {
      disconnectedBridge?: boolean
      promptIdentifier?: string
    },
  ) => void
}

function generatePromptIdentifier(): string {
  return crypto.randomUUID()
}

function getUltraplanLaunchConfig(_identifier: string) {
  return {
    dialogBody:
      'Ultraplan sends your task to Claude Code on the web for deep exploration. Claude will research, draft a detailed plan, and return it here for your review before any code is changed.',
    dialogPipeline:
      'Your prompt → Claude Code on the web → Plan review → Implementation',
    timeEstimate: '~10–30 min',
  }
}

export function UltraplanLaunchDialog({
  onChoice,
}: UltraplanLaunchDialogProps): React.ReactNode {
  const [showTermsLink] = React.useState(
    () => !getGlobalConfig().hasSeenUltraplanTerms,
  )
  const [promptIdentifier] = React.useState(() => generatePromptIdentifier())
  const config = React.useMemo(
    () => getUltraplanLaunchConfig(promptIdentifier),
    [promptIdentifier],
  )
  const isBridgeEnabled = useAppState(state => state.replBridgeEnabled)
  const setAppState = useSetAppState()

  const handleChoice = React.useCallback(
    (value: ChoiceValue) => {
      const disconnectedBridge = value === 'run' && isBridgeEnabled

      if (disconnectedBridge) {
        setAppState(prev => {
          if (!prev.replBridgeEnabled) return prev
          return {
            ...prev,
            replBridgeEnabled: false,
            replBridgeExplicit: false,
            replBridgeOutboundOnly: false,
          }
        })
      }

      if (value !== 'cancel' && showTermsLink) {
        saveGlobalConfig(prev =>
          prev.hasSeenUltraplanTerms
            ? prev
            : { ...prev, hasSeenUltraplanTerms: true },
        )
      }

      onChoice(value, { disconnectedBridge, promptIdentifier })
    },
    [onChoice, promptIdentifier, isBridgeEnabled, setAppState, showTermsLink],
  )

  const runDescription = isBridgeEnabled
    ? 'Disable remote control and launch in Claude Code on the web'
    : 'launch in Claude Code on the web'

  const options = React.useMemo(
    () => [
      {
        label: 'Run ultraplan',
        value: 'run' as const,
        description: runDescription,
      },
      { label: 'Not now', value: 'cancel' as const },
    ],
    [runDescription],
  )

  return (
    <PermissionDialog
      title="Run ultraplan in the cloud?"
      subtitle={config.timeEstimate}
    >
      <Box flexDirection="column" gap={1}>
        <Box flexDirection="column">
          <Text dimColor>{config.dialogBody}</Text>
          {isBridgeEnabled && (
            <Text dimColor>
              This will disable Remote Control for this session.
            </Text>
          )}
          {showTermsLink && (
            <Text dimColor>
              For more information on Claude Code on the web:{' '}
              <Link url={CCR_TERMS_URL}>{CCR_TERMS_URL}</Link>
            </Text>
          )}
        </Box>

        {!isBridgeEnabled && <Text dimColor>{config.dialogPipeline}</Text>}

        <Select options={options} onChange={handleChoice} />
      </Box>
    </PermissionDialog>
  )
}

export default UltraplanLaunchDialog
