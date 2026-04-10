import { beforeEach, describe, expect, it, vi } from "vitest";

const mockReadDir = vi.fn();
const mockStat = vi.fn();

vi.mock("@/lib/utils", () => ({
  isTauri: () => true,
}));

vi.mock("@tauri-apps/plugin-fs", () => ({
  readDir: (...args: unknown[]) => mockReadDir(...args),
  stat: (...args: unknown[]) => mockStat(...args),
}));

import { useWorkspaceStore } from "../workspace";

describe("workspace loadDirectory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useWorkspaceStore.setState({
      workspacePath: "/workspace",
      fileTree: [],
      expandedPaths: new Set<string>(),
      loadingPaths: new Set<string>(),
    });
  });

  it("treats symlinked directories as directories", async () => {
    mockReadDir.mockResolvedValue([
      {
        name: "linked-dir",
        isDirectory: false,
        isFile: false,
        isSymlink: true,
      },
    ]);
    mockStat.mockResolvedValue({
      isDirectory: true,
      isFile: false,
      isSymlink: false,
    });

    const result = await useWorkspaceStore.getState().loadDirectory(".");

    expect(mockStat).toHaveBeenCalledWith("/workspace/linked-dir");
    expect(result).toEqual([
      {
        name: "linked-dir",
        path: "/workspace/linked-dir",
        type: "directory",
      },
    ]);
  });

  it("keeps symlinked files as files", async () => {
    mockReadDir.mockResolvedValue([
      {
        name: "linked-file.ts",
        isDirectory: false,
        isFile: false,
        isSymlink: true,
      },
    ]);
    mockStat.mockResolvedValue({
      isDirectory: false,
      isFile: true,
      isSymlink: false,
    });

    const result = await useWorkspaceStore.getState().loadDirectory(".");

    expect(mockStat).toHaveBeenCalledWith("/workspace/linked-file.ts");
    expect(result).toEqual([
      {
        name: "linked-file.ts",
        path: "/workspace/linked-file.ts",
        type: "file",
      },
    ]);
  });
});
