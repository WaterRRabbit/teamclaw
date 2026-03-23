import { create } from "zustand"
import { isTauri } from "@/lib/utils"

export type UpdateState =
  | "idle"
  | "checking"
  | "available"
  | "up-to-date"
  | "downloading"
  | "ready"
  | "error"

export interface UpdateInfo {
  state: UpdateState
  version?: string
  notes?: string
  progress?: number
  errorMessage?: string
}

type PendingUpdate = any // Tauri Update object

interface UpdaterStore {
  update: UpdateInfo
  pendingUpdate: PendingUpdate | null
  setUpdate: (info: UpdateInfo) => void
  checkForUpdates: (silent?: boolean) => Promise<void>
  installUpdate: () => Promise<void>
  restart: () => Promise<void>
}

export const useUpdaterStore = create<UpdaterStore>((set, get) => ({
  update: { state: "idle" },
  pendingUpdate: null,

  setUpdate: (info) => set({ update: info }),

  checkForUpdates: async (silent = false) => {
    if (!isTauri()) {
      if (!silent) {
        set({ update: { state: "error", errorMessage: "Updates are only available in the desktop app." } })
      }
      return
    }

    set({ update: { state: "checking" } })

    try {
      const { check } = await import("@tauri-apps/plugin-updater")
      const update = await check()

      if (update?.available) {
        set({
          update: {
            state: "available",
            version: update.version,
            notes: update.body || "",
          },
          pendingUpdate: update,
        })
      } else {
        set({ update: { state: "up-to-date" }, pendingUpdate: null })
        // Auto-clear after 3s
        setTimeout(() => {
          const current = get().update
          if (current.state === "up-to-date") {
            set({ update: { state: "idle" } })
          }
        }, 3000)
      }
    } catch (err) {
      if (silent) {
        console.warn("[Updater] Check failed (silent):", err)
        set({ update: { state: "idle" } })
      } else {
        console.error("[Updater] Check failed:", err)
        set({ update: { state: "error", errorMessage: String(err) } })
      }
    }
  },

  installUpdate: async () => {
    const pending = get().pendingUpdate
    if (!pending || typeof pending !== 'object' || !('download' in pending)) {
      set({ update: { state: "error", errorMessage: "No pending update to install." } })
      return
    }

    set({ update: { state: "downloading", progress: 0 } })

    try {
      const { listen } = await import("@tauri-apps/api/event")

      // Listen for download progress events
      const unlisten = await listen<{ downloaded: number; contentLength: number | null }>(
        "update-download-progress",
        (event) => {
          const { downloaded, contentLength } = event.payload
          if (contentLength && contentLength > 0) {
            set({
              update: {
                state: "downloading",
                progress: Math.round((downloaded / contentLength) * 100),
              },
            })
          }
        },
      )

      try {
        // Use Tauri official updater API
        await pending.downloadAndInstall()
        set({ update: { state: "ready" }, pendingUpdate: null })
      } finally {
        unlisten()
      }
    } catch (err) {
      console.error("[Updater] Install failed:", err)
      set({ update: { state: "error", errorMessage: String(err) } })
    }
  },

  restart: async () => {
    try {
      const { relaunch } = await import("@tauri-apps/plugin-process")
      await relaunch()
    } catch (err) {
      console.error("[Updater] Relaunch failed:", err)
      set({
        update: {
          state: "error",
          errorMessage: "Failed to restart. Please restart manually.",
        },
      })
    }
  },
}))
