import type { PrivateRoom } from "./types.ts";

/**
 * The room list to back up on the node: the rooms I am in here, plus every room the backup holds that this page
 * has not loaded yet. Page storage starts empty each session, so a save can run before the restore lands; writing
 * only what is here would wipe the rooms still being restored. A room this page holds without me (kicked) stays out.
 */
export function mergeRoomBackup(local: PrivateRoom[], saved: PrivateRoom[], me: string): PrivateRoom[] {
  const here = new Set(local.map((r) => r?.id));
  return [...local.filter((r) => r?.members?.includes(me)), ...saved.filter((r) => r?.id && !here.has(r.id))];
}
