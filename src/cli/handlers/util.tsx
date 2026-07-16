import { c as _c } from "react/compiler-runtime";
/**
 * Miscellaneous subcommand handlers — extracted from main.tsx for lazy loading.
 * setup-token, doctor, install
 */
/* eslint-disable custom-rules/no-process-exit -- CLI subcommand handlers intentionally exit */

import { cwd } from 'process';
import React from 'react';
import { WelcomeV2 } from '../../components/LogoV2/WelcomeV2.js';
import { useManagePlugins } from '../../hooks/useManagePlugins.js';
import type { Root } from '../../ink.js';
import { Box, Text } from '../../ink.js';
import { KeybindingSetup } from '../../keybindings/KeybindingProviderSetup.js';
import { logEvent } from '../../services/analytics/index.js';
import { MCPConnectionManager } from '../../services/mcp/MCPConnectionManager.js';
import { AppStateProvider } from '../../state/AppState.js';
import { onChangeAppState } from '../../state/onChangeAppState.js';
import { isAnthropicAuthEnabled } from '../../utils/auth.js';
import { getDoctorDiagnostic } from '../../utils/doctorDiagnostic.js';
import { getSettingsWithAllErrors } from '../../utils/settings/allErrors.js';
import { writeToStdout } from '../../utils/process.js';
export async function setupTokenHandler(root: Root): Promise<void> {
  logEvent('tengu_setup_token_command', {});
  const showAuthWarning = !isAnthropicAuthEnabled();
  const {
    ConsoleOAuthFlow
  } = await import('../../components/ConsoleOAuthFlow.js');
  await new Promise<void>(resolve => {
    root.render(<AppStateProvider onChangeAppState={onChangeAppState}>
        <KeybindingSetup>
          <Box flexDirection="column" gap={1}>
            <WelcomeV2 />
            {showAuthWarning && <Box flexDirection="column">
                <Text color="warning">
                  Warning: You already have authentication configured via
                  environment variable or API key helper.
                </Text>
                <Text color="warning">
                  The setup-token command will create a new OAuth token which
                  you can use instead.
                </Text>
              </Box>}
            <ConsoleOAuthFlow onDone={() => {
            void resolve();
          }} mode="setup-token" startingMessage="This will guide you through long-lived (1-year) auth token setup for your Claude account. Claude subscription required." />
          </Box>
        </KeybindingSetup>
      </AppStateProvider>);
  });
  root.unmount();
  process.exit(0);
}

// DoctorWithPlugins wrapper + doctor handler
const DoctorLazy = React.lazy(() => import('../../screens/Doctor.js').then(m => ({
  default: m.Doctor
})));
function DoctorWithPlugins(t0) {
  const $ = _c(2);
  const {
    onDone
  } = t0;
  useManagePlugins();
  let t1;
  if ($[0] !== onDone) {
    t1 = <React.Suspense fallback={null}><DoctorLazy onDone={onDone} /></React.Suspense>;
    $[0] = onDone;
    $[1] = t1;
  } else {
    t1 = $[1];
  }
  return t1;
}
export async function doctorHandler(): Promise<void> {
  logEvent('tengu_doctor_command', {});
  const diagnostic = await getDoctorDiagnostic();
  const { errors } = getSettingsWithAllErrors();
  const lines = [
    'recode doctor',
    '',
    `Version: ${diagnostic.version}`,
    `Currently running: ${diagnostic.installationType}`,
    `Installation path: ${diagnostic.installationPath}`,
    `Invoked binary: ${diagnostic.invokedBinary}`,
    `Config install method: ${diagnostic.configInstallMethod}`,
    `Auto updates: ${diagnostic.autoUpdates}`,
    `Update permissions: ${diagnostic.hasUpdatePermissions === null ? 'unknown' : diagnostic.hasUpdatePermissions ? 'ok' : 'missing'}`,
    `Search: ${diagnostic.ripgrepStatus.working ? 'ok' : 'not working'} (${diagnostic.ripgrepStatus.mode}${diagnostic.ripgrepStatus.systemPath ? `: ${diagnostic.ripgrepStatus.systemPath}` : ''})`,
  ];
  if (diagnostic.packageManager) {
    lines.push(`Package manager: ${diagnostic.packageManager}`);
  }
  if (diagnostic.recommendation) {
    lines.push('', `Recommendation: ${diagnostic.recommendation}`);
  }
  if (diagnostic.multipleInstallations.length > 0) {
    lines.push('', 'Multiple installations');
    for (const install of diagnostic.multipleInstallations) {
      lines.push(`- ${install.type}: ${install.path}`);
    }
  }
  if (diagnostic.warnings.length > 0) {
    lines.push('', 'Warnings');
    for (const warning of diagnostic.warnings) {
      lines.push(`- ${warning.issue}`);
      lines.push(`  Fix: ${warning.fix}`);
    }
  }
  if (errors.length > 0) {
    lines.push('', 'Invalid settings');
    for (const error of errors) {
      const location = [error.file, error.path].filter(Boolean).join(':');
      lines.push(`- ${location || '(unknown)'}: ${error.message}`);
    }
  }
  writeToStdout(lines.join('\n') + '\n');
  process.exit(0);
}

// install handler
export async function installHandler(target: string | undefined, options: {
  force?: boolean;
}): Promise<void> {
  const {
    setup
  } = await import('../../setup.js');
  await setup(cwd(), 'default', false, false, undefined, false);
  const {
    install
  } = await import('../../commands/install.js');
  await new Promise<void>(resolve => {
    const args: string[] = [];
    if (target) args.push(target);
    if (options.force) args.push('--force');
    void install.call(result => {
      void resolve();
      process.exit(result.includes('failed') ? 1 : 0);
    }, {}, args);
  });
}
