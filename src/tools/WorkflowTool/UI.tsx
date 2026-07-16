import React from 'react';
import { MessageResponse } from '../../components/MessageResponse.js';
import { Text } from '../../ink.js';
import type { Input, Output } from './WorkflowTool.js';

export function renderToolUseMessage(input: Input): React.ReactNode {
  if (input.action === 'launch') {
    return <Text dimColor>Launching workflow: {input.template_name ?? input.spec?.name ?? 'unnamed'}</Text>;
  }
  return (
    <Text dimColor>
      {input.action} workflow {input.run_id}
    </Text>
  );
}

export function renderToolResultMessage(output: Output): React.ReactNode {
  if (output.error) {
    return (
      <MessageResponse>
        <Text color="error">Workflow error: {output.error}</Text>
      </MessageResponse>
    );
  }
  const message = output.message ?? (output.run ? `${output.run.name}: ${output.run.status}` : undefined);
  return message ? (
    <MessageResponse>
      <Text>{message}</Text>
    </MessageResponse>
  ) : null;
}

export function renderToolUseRejectedMessage(): React.ReactNode {
  return <Text color="warning">Workflow operation rejected</Text>;
}
