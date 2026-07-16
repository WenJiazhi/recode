import React from 'react';
import { MessageResponse } from '../../components/MessageResponse.js';
import { Text } from '../../ink.js';
import type { Input, Output } from './GoalTool.js';

function resolveAction(input: Input): 'get' | 'checkpoint' | 'update' {
  return input.action ?? (input.status ? 'update' : input.summary ? 'checkpoint' : 'get');
}

export function renderToolUseMessage(input: Input): React.ReactNode {
  const action = resolveAction(input);
  if (action === 'get') return <Text dimColor>Checking Goal status...</Text>;
  if (action === 'checkpoint') {
    return <Text dimColor>Saving Goal checkpoint...</Text>;
  }
  return <Text dimColor>Updating Goal: {input.status ?? 'unknown'}</Text>;
}

export function renderToolResultMessage(output: Output): React.ReactNode {
  if (output.error) {
    return (
      <MessageResponse>
        <Text color="error">Goal error: {output.error}</Text>
      </MessageResponse>
    );
  }

  const content = output.report ?? output.message;
  return content ? (
    <MessageResponse>
      <Text>{content}</Text>
    </MessageResponse>
  ) : null;
}

export function renderToolUseRejectedMessage(): React.ReactNode {
  return <Text color="warning">Goal operation rejected</Text>;
}
