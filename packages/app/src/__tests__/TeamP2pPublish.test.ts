import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import * as React from 'react'

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string | Record<string, unknown>) => {
      if (typeof fallback === 'string') return fallback
      if (typeof fallback === 'object' && fallback && 'defaultValue' in fallback) return (fallback as { defaultValue: string }).defaultValue
      return key
    },
  }),
}))

// Mock Tauri event API to prevent transformCallback errors
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(async () => () => {}),
}))

let createResult: string | Error = 'ok'
let afterCreateConnected = false

const mockInvoke = vi.fn(async (cmd: string) => {
  if (cmd === 'get_device_info') return { nodeId: 'test-node', platform: 'macos', arch: 'aarch64', hostname: 'test-mac' }
  if (cmd === 'get_p2p_config') return null
  if (cmd === 'p2p_sync_status') {
    if (afterCreateConnected) {
      return { connected: true, role: 'owner', docTicket: 'blobt1cketstr1ng-test-ticket-value', namespaceId: 'ns-123', lastSyncAt: null, members: [{ nodeId: 'test-node', label: 'test-mac', platform: 'macos', arch: 'aarch64', hostname: 'test-mac', addedAt: '2026-01-01' }] }
    }
    return null
  }
  if (cmd === 'webdav_get_status') return null
  if (cmd === 'p2p_reconnect') return null
  if (cmd === 'p2p_check_team_dir') return { exists: false, hasMembers: false }
  if (cmd === 'p2p_create_team') {
    if (createResult instanceof Error) throw createResult
    afterCreateConnected = true
    return createResult
  }
  if (cmd === 'unified_team_get_members') return []
  if (cmd === 'unified_team_get_my_role') return null
  if (cmd === 'list_team_members') return []
  if (cmd === 'get_my_role') return null
  return null
})

vi.mock('@tauri-apps/api/core', () => ({
  invoke: mockInvoke,
}))

beforeEach(() => {
  vi.clearAllMocks()
  createResult = 'ok'
  afterCreateConnected = false
  ;(window as unknown as { __TAURI__: unknown }).__TAURI__ = {}
  ;(window as unknown as { __TAURI_INTERNALS__: unknown }).__TAURI_INTERNALS__ = {
    invoke: mockInvoke,
    transformCallback: vi.fn(() => Math.random()),
  }
})

async function renderAndSwitchToP2P() {
  const { TeamSection } = await import('../components/settings/TeamSection')
  await act(async () => {
    render(React.createElement(TeamSection))
  })
  // Switch to P2P tab (OSS/S3 is default now)
  await act(async () => {
    const tabs = screen.getAllByRole('tab')
    const p2pTab = tabs.find(t => t.textContent?.includes('P2P'))!
    fireEvent.click(p2pTab)
  })
}

describe('TeamP2P Publish Flow', () => {
  it('shows "Create Team Drive" button in P2P tab', async () => {
    await renderAndSwitchToP2P()

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /create team drive/i })).toBeDefined()
    })
  })

  it('calls p2p_create_team and displays ticket on success', async () => {
    await renderAndSwitchToP2P()

    // Wait for init effects
    await act(async () => {
      await new Promise(r => setTimeout(r, 50))
    })

    // Click create
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /create team drive/i }))
    })

    await waitFor(() => {
      expect(screen.getByText('blobt1cketstr1ng-test-ticket-value')).toBeDefined()
    })
  })

  it('shows copy button after ticket is generated', async () => {
    await renderAndSwitchToP2P()

    await act(async () => {
      await new Promise(r => setTimeout(r, 50))
    })

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /create team drive/i }))
    })

    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: /copy/i }).length).toBeGreaterThan(0)
    })
  })

  it('shows error when create fails', async () => {
    createResult = new Error('No team content to publish')

    await renderAndSwitchToP2P()

    await act(async () => {
      await new Promise(r => setTimeout(r, 50))
    })

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /create team drive/i }))
    })

    await waitFor(() => {
      expect(screen.getByText(/no team content to publish/i)).toBeDefined()
    })
  })
})
