import type { BrowserWindow, WebContentsView, Session } from "electron";
export interface ToolManifest {
  schema: 1; id: string; name: string; description?: string; version: string;
  sdk: 1; dataVersion: number; runtime: "electron-45.2.3";
  targets: Array<"darwin-arm64" | "darwin-x64" | "win32-x64" | "win32-arm64" | "linux-x64">;
  capabilities: Array<"microphone" | "system-audio" | "keyboard" | "clipboard" | "files" | "network" | "computer">;
  adapter: string; workspace: string; preload: string;
}
export interface ToolStatus { busy: boolean; reason?: string; background?: boolean }
export interface ToolInstance {
  status(): Promise<ToolStatus>;
  dispose(): Promise<void>;
  onVisibility?(visible: boolean): void;
}
export interface ToolHostContext {
  window: BrowserWindow; view: WebContentsView; session: Session;
  dataDir: string; resourceDir: string; sharedModelRoot?: string;
  manifest: ToolManifest; protectedRoots: string[];
  handle(channel: string, handler: (...args: any[]) => any): void;
  emit(channel: string, event: unknown): void;
  on(emitter: NodeJS.EventEmitter, event: string, listener: (...args: any[]) => void): void;
  show(): void;
  close(): Promise<{ requested: true }>;
}
export interface ToolAdapter { activate(host: ToolHostContext): Promise<ToolInstance> }
export function validateManifest(value: unknown): ToolManifest;
export function canonical(value: unknown): string;
export function hash(value: Uint8Array): string;
export function safePath(value: string): string;
export function sign(value: unknown, key: import("node:crypto").KeyLike): string;
export function verify(value: unknown, signature: string, key: import("node:crypto").KeyLike): boolean;
