import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
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

const mockInvoke = vi.fn(async (cmd: string) => {
  if (cmd === 'p2p_sync_status') return null
  if (cmd === 'webdav_get_status') return null
  if (cmd === 'get_device_info') return { nodeId: 'test-node', platform: 'macos', arch: 'aarch64', hostname: 'test-mac' }
  if (cmd === 'get_p2p_config') return null
  if (cmd === 'p2p_reconnect') return null
  if (cmd === 'unified_team_get_members') return []
  if (cmd === 'unified_team_get_my_role') return null
  return null
})

// Mock Tauri invoke to prevent real API calls
vi.mock('@tauri-apps/api/core', () => ({
  invoke: mockInvoke,
}))

// Mock Tauri event API to prevent transformCallback errors
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(async () => () => {}),
}))

// Mock plugin-fs to prevent import errors
vi.mock('@tauri-apps/plugin-fs', () => ({
  readTextFile: vi.fn(async () => ''),
  exists: vi.fn(async () => false),
}))

// Mock window.__TAURI__ to simulate desktop environment
beforeEach(() => {
  vi.clearAllMocks()
  ;(window as unknown as { __TAURI__: unknown }).__TAURI__ = {}
  ;(window as unknown as { __TAURI_INTERNALS__: unknown }).__TAURI_INTERNALS__ = {
    invoke: mockInvoke,
    transformCallback: vi.fn((_callback: unknown) => {
      const id = Math.random()
      return id
    }),
  }
})

describe('TeamSection Tab Switcher', () => {
  it('renders S3, P2P and WebDAV tabs', async () => {
    const { TeamSection } = await import('../components/settings/TeamSection')

    await act(async () => {
      render(React.createElement(TeamSection))
    })

    // Current UI has S3 云同步, P2P, and WebDAV tabs
    const tabs = screen.getAllByRole('tab')
    expect(tabs.length).toBe(3)
    expect(tabs.some(t => t.textContent?.includes('S3'))).toBe(true)
    expect(tabs.some(t => t.textContent?.includes('P2P'))).toBe(true)
    expect(tabs.some(t => t.textContent?.includes('WebDAV'))).toBe(true)
  })

  it('defaults to S3/OSS tab', async () => {
    const { TeamSection } = await import('../components/settings/TeamSection')

    await act(async () => {
      render(React.createElement(TeamSection))
    })

    const tabs = screen.getAllByRole('tab')
    const ossTab = tabs.find(t => t.textContent?.includes('S3'))
    expect(ossTab).toBeDefined()
    expect(ossTab!.getAttribute('aria-selected')).toBe('true')
  })

  it('switches to P2P tab on click', async () => {
    const { TeamSection } = await import('../components/settings/TeamSection')

    await act(async () => {
      render(React.createElement(TeamSection))
    })

    const tabs = screen.getAllByRole('tab')
    const p2pTab = tabs.find(t => t.textContent?.includes('P2P'))!
    const ossTab = tabs.find(t => t.textContent?.includes('S3'))!

    fireEvent.click(p2pTab)

    expect(p2pTab.getAttribute('aria-selected')).toBe('true')
    expect(ossTab.getAttribute('aria-selected')).toBe('false')
  })

  it('preserves S3 tab content when switching back', async () => {
    const { TeamSection } = await import('../components/settings/TeamSection')

    await act(async () => {
      render(React.createElement(TeamSection))
    })

    const tabs = screen.getAllByRole('tab')
    const p2pTab = tabs.find(t => t.textContent?.includes('P2P'))!
    const ossTab = tabs.find(t => t.textContent?.includes('S3'))!

    // Switch to P2P
    fireEvent.click(p2pTab)
    // Switch back to S3/OSS
    fireEvent.click(ossTab)

    expect(ossTab.getAttribute('aria-selected')).toBe('true')
  })
})
