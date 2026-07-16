import { expect, test } from 'bun:test'
import {
  isFrozenAccountCommand,
  meetsAvailabilityRequirement,
} from '../../commands.js'

test('account-only commands are frozen in the API-key-only build', () => {
  for (const name of [
    'login',
    'logout',
    'voice',
    'chrome',
    'mobile',
    'ultraplan',
  ]) {
    expect(isFrozenAccountCommand({ name })).toBe(true)
  }

  expect(isFrozenAccountCommand({ name: 'model' })).toBe(false)
})

test('account availability never exposes commands in the current build', () => {
  expect(
    meetsAvailabilityRequirement({
      availability: ['claude-ai'],
      description: 'account command',
      name: 'account-command',
      type: 'local',
      supportsNonInteractive: true,
      load: async () => ({ call: async () => null }),
    }),
  ).toBe(false)
})
