import { afterEach, describe, expect, test } from 'bun:test'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { dirname, join } from 'path'
import { getSessionId, resetStateForTests, setOriginalCwd, setProjectRoot } from '../../bootstrap/state.js'
import { parseJSONL } from '../../utils/json.js'
import { getTranscriptPath, getTranscriptPathForSession } from '../../utils/sessionStorage.js'
import { call, deriveFirstPrompt } from './branch.js'

const tempDirs: string[] = []
const initialProcessCwd = process.cwd()

describe('deriveFirstPrompt', () => {
  afterEach(() => {
    process.chdir(initialProcessCwd)
    setOriginalCwd(initialProcessCwd)
    setProjectRoot(initialProcessCwd)
    resetStateForTests()

    while (tempDirs.length > 0) {
      const dir = tempDirs.pop()
      if (dir) {
        rmSync(dir, { recursive: true, force: true })
      }
    }
  })

  test('falls back when there is no first user message', () => {
    expect(deriveFirstPrompt(undefined)).toBe('Branched conversation')
  })

  test('collapses whitespace for string content', () => {
    expect(
      deriveFirstPrompt({
        type: 'user',
        uuid: 'u1',
        sessionId: 's1',
        timestamp: new Date().toISOString(),
        message: {
          role: 'user',
          content: 'first line\n\nsecond\tline',
        },
      } as any),
    ).toBe('first line second line')
  })

  test('extracts the first text block from structured content', () => {
    expect(
      deriveFirstPrompt({
        type: 'user',
        uuid: 'u2',
        sessionId: 's2',
        timestamp: new Date().toISOString(),
        message: {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', data: 'x' } },
            { type: 'text', text: '  explain this repo structure  ' },
          ],
        },
      } as any),
    ).toBe('explain this repo structure')
  })

  test('truncates very long prompts to 100 characters', () => {
    const longPrompt = 'a'.repeat(120)
    expect(
      deriveFirstPrompt({
        type: 'user',
        uuid: 'u3',
        sessionId: 's3',
        timestamp: new Date().toISOString(),
        message: {
          role: 'user',
          content: longPrompt,
        },
      } as any),
    ).toHaveLength(100)
  })

  test('branch call forks the transcript, preserves content replacements, and resumes into the fork', async () => {
    const tempDir = join(tmpdir(), `recode-branch-${Date.now()}-${Math.random().toString(36).slice(2)}`)
    mkdirSync(tempDir, { recursive: true })
    tempDirs.push(tempDir)

    process.chdir(tempDir)
    setOriginalCwd(tempDir)
    setProjectRoot(tempDir)

    const originalSessionId = getSessionId()
    const transcriptPath = getTranscriptPath()
    mkdirSync(dirname(transcriptPath), { recursive: true })

    const timestamp = new Date().toISOString()
    writeFileSync(
      transcriptPath,
      [
        JSON.stringify({
          type: 'user',
          uuid: 'user-1',
          parentUuid: null,
          isSidechain: false,
          sessionId: originalSessionId,
          timestamp,
          cwd: tempDir,
          userType: 'external',
          version: '0.0.1',
          message: {
            role: 'user',
            content: 'please review this patch',
          },
        }),
        JSON.stringify({
          type: 'assistant',
          uuid: 'assistant-1',
          parentUuid: 'user-1',
          isSidechain: false,
          sessionId: originalSessionId,
          timestamp,
          cwd: tempDir,
          userType: 'external',
          version: '0.0.1',
          message: {
            role: 'assistant',
            content: [{ type: 'text', text: 'ok' }],
          },
        }),
        JSON.stringify({
          type: 'content-replacement',
          sessionId: originalSessionId,
          replacements: [
            {
              toolUseId: 'tool-1',
              preview: 'short preview',
              contentRef: 'ref-1',
            },
          ],
        }),
      ].join('\n') + '\n',
      'utf8',
    )

    let resumed: { sessionId: string; log: any; mode: string } | null = null
    let doneMessage = ''

    await call(
      message => {
        doneMessage = String(message)
      },
      {
        resume: async (sessionId, log, mode) => {
          resumed = { sessionId, log, mode }
        },
      } as any,
      '',
    )

    expect(resumed).not.toBeNull()
    expect(resumed?.mode).toBe('fork')
    expect(resumed?.sessionId).not.toBe(originalSessionId)
    expect(resumed?.log.customTitle).toBe('please review this patch (Branch)')
    expect(resumed?.log.contentReplacements).toEqual([
      {
        toolUseId: 'tool-1',
        preview: 'short preview',
        contentRef: 'ref-1',
      },
    ])
    expect(doneMessage).toContain('You are now in the branch.')
    expect(doneMessage).toContain(`recode -r ${originalSessionId}`)

    const forkPath = getTranscriptPathForSession(resumed!.sessionId)
    const entries = parseJSONL<any>(readFileSync(forkPath))
    const forkedUser = entries.find((entry: any) => entry.type === 'user')
    const replacementEntry = entries.find(
      (entry: any) => entry.type === 'content-replacement',
    )
    const customTitleEntry = entries.find(
      (entry: any) => entry.type === 'custom-title',
    )

    expect(forkedUser.sessionId).toBe(resumed?.sessionId)
    expect(forkedUser.forkedFrom).toEqual({
      sessionId: originalSessionId,
      messageUuid: 'user-1',
    })
    expect(replacementEntry.sessionId).toBe(resumed?.sessionId)
    expect(replacementEntry.replacements).toEqual([
      {
        toolUseId: 'tool-1',
        preview: 'short preview',
        contentRef: 'ref-1',
      },
    ])
    expect(customTitleEntry.customTitle).toBe('please review this patch (Branch)')
  })

  test('branch call chooses the next available numbered branch title on collisions', async () => {
    const tempDir = join(
      tmpdir(),
      `recode-branch-collision-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    )
    mkdirSync(tempDir, { recursive: true })
    tempDirs.push(tempDir)

    process.chdir(tempDir)
    setOriginalCwd(tempDir)
    setProjectRoot(tempDir)

    const originalSessionId = getSessionId()
    const transcriptPath = getTranscriptPath()
    mkdirSync(dirname(transcriptPath), { recursive: true })

    const timestamp = new Date().toISOString()
    writeFileSync(
      transcriptPath,
      [
        JSON.stringify({
          type: 'user',
          uuid: 'user-branch-collision-1',
          parentUuid: null,
          isSidechain: false,
          sessionId: originalSessionId,
          timestamp,
          cwd: tempDir,
          userType: 'external',
          version: '0.0.1',
          message: {
            role: 'user',
            content: 'please review this patch',
          },
        }),
      ].join('\n') + '\n',
      'utf8',
    )

    const existingBranchSessionIds = [
      '11111111-1111-4111-8111-111111111111',
      '33333333-3333-4333-8333-333333333333',
    ]

    writeFileSync(
      getTranscriptPathForSession(existingBranchSessionIds[0]),
      `${JSON.stringify({
        type: 'custom-title',
        sessionId: existingBranchSessionIds[0],
        customTitle: 'please review this patch (Branch)',
      })}\n`,
      'utf8',
    )
    writeFileSync(
      getTranscriptPathForSession(existingBranchSessionIds[1]),
      `${JSON.stringify({
        type: 'custom-title',
        sessionId: existingBranchSessionIds[1],
        customTitle: 'please review this patch (Branch 3)',
      })}\n`,
      'utf8',
    )

    let resumed: { sessionId: string; log: any; mode: string } | null = null

    await call(
      () => {},
      {
        resume: async (sessionId, log, mode) => {
          resumed = { sessionId, log, mode }
        },
      } as any,
      '',
    )

    expect(resumed).not.toBeNull()
    expect(resumed?.mode).toBe('fork')
    expect(resumed?.log.customTitle).toBe('please review this patch (Branch 2)')

    const entries = parseJSONL<any>(
      readFileSync(getTranscriptPathForSession(resumed!.sessionId)),
    )
    const customTitleEntry = entries.find(
      (entry: any) => entry.type === 'custom-title',
    )
    expect(customTitleEntry.customTitle).toBe(
      'please review this patch (Branch 2)',
    )
  })
})
