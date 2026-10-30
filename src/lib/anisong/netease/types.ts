export type NeteaseSong = { id: string; title: string; artist: string; album: string; coverUrl: string | null; duration: number; restricted: boolean };
export type NeteaseAccount = { enabled: boolean; connected: boolean; nickname?: string; message?: string };
export type NeteasePlayback = { url: string; expiresAt: number; trial: boolean };
