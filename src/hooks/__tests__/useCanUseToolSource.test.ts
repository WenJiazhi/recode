import { expect, test } from 'bun:test'

test('useCanUseTool uses the env-aware bridge gate for interactive permission forwarding', async () => {
  const source = await Bun.file('src/hooks/useCanUseTool.tsx').text()

  expect(source).toContain("import { isBridgeFeatureEnabled } from '../bridge/bridgeEnabled.js';")
  expect(source).toContain('bridgeCallbacks: isBridgeFeatureEnabled() ? appState.replBridgePermissionCallbacks : undefined')
  expect(source).not.toContain('bridgeCallbacks: feature("BRIDGE_MODE") ? appState.replBridgePermissionCallbacks : undefined')
})
