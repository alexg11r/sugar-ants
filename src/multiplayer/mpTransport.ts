import { AntSkinId, PlayableAntId } from '../core/types';
import { onlineDirectory, RoomEnvelope } from './onlineDirectory';

export type MpMode = 'versus' | 'coop';
export type MpMapSizePreset = 'auto' | 'compact' | 'large' | 'huge';

export interface MpPlayerInfo {
  id: string;
  nick: string;
  colorIndex: number; // 0..9
  skin: AntSkinId;
  isHost: boolean;
  dug: number;
  baseX: number;
  baseY: number;
}

export interface ChatMessage {
  id: string;
  senderNick: string;
  senderColor: string;
  text: string;
  system?: boolean;
  ts: number;
}

export interface LobbyListing {
  code: string;
  hostNick: string;
  mpMode: MpMode;
  levelId: string;
  hasPassword: boolean;
  playerCount: number;
  maxPlayers: number;
  inGame: boolean;
  updatedAt: number;
}

export type MpMessage =
  | { type: 'hello'; player: MpPlayerInfo; password?: string }
  | { type: 'reject'; reason: string }
  | {
      type: 'lobby_state';
      players: MpPlayerInfo[];
      mpMode: MpMode;
      levelId: string;
      mapSizePreset: MpMapSizePreset;
      inGame: boolean;
      code: string;
    }
  | { type: 'update_profile'; playerId: string; nick: string; colorIndex: number; skin: AntSkinId }
  | { type: 'chat'; msg: ChatMessage }
  | { type: 'start'; seed: number; levelId: string; mpMode: MpMode; players: MpPlayerInfo[]; width: number; height: number }
  | { type: 'late_sync'; seed: number; levelId: string; mpMode: MpMode; players: MpPlayerInfo[]; width: number; height: number; dugEvents: [number, number, number, number][] }
  | { type: 'spawn'; playerId: string; antType: PlayableAntId; x: number; y: number; angle: number }
  | { type: 'dig'; playerId: string; x: number; y: number; radius: number; damage: number }
  | { type: 'ping'; playerId: string; nick: string; colorHex: string; x: number; y: number }
  | { type: 'sugar_win'; winnerId: string; winnerNick: string }
  | { type: 'vote_start'; reason: string; options: string[] }
  | { type: 'vote_cast'; playerId: string; choice: string }
  | {
      type: 'coop_event';
      eventId:
        | 'sugar_rush'
        | 'crystal_shower'
        | 'wild_swarm'
        | 'quake'
        | 'royal_blessing'
        | 'worm_cavein'
        | 'rockslide';
      seed: number;
    }
  | { type: 'next_level'; seed: number; levelId: string; players: MpPlayerInfo[]; width: number; height: number }
  | { type: 'leave'; playerId: string };

export interface MpTransportCallbacks {
  onStatus: (status: string) => void;
  onMessage: (msg: MpMessage, fromPeerId: string) => void;
  onPeerDisconnected: (peerId: string) => void;
}

const LOBBY_STORAGE_KEY = 'sugar_ants_open_lobbies_v1';

/** Returns merged GLOBAL ONLINE lobbies + local fallback lobbies! */
export function listOpenLobbies(): LobbyListing[] {
  const merged = new Map<string, LobbyListing>();

  // 1. Local fallback entries
  try {
    const raw = localStorage.getItem(LOBBY_STORAGE_KEY);
    if (raw) {
      const localList = JSON.parse(raw) as LobbyListing[];
      const now = Date.now();
      for (const l of localList) {
        if (now - l.updatedAt < 18000) merged.set(l.code, l);
      }
    }
  } catch {
    // Ignore
  }

  // 2. Global online lobbies from MQTT broker (overrides local if same code)
  for (const l of onlineDirectory.getOnlineLobbies()) {
    merged.set(l.code, l);
  }

  return Array.from(merged.values()).sort((a, b) => b.updatedAt - a.updatedAt);
}

function upsertLocalLobby(entry: LobbyListing) {
  try {
    const raw = localStorage.getItem(LOBBY_STORAGE_KEY);
    const list = raw ? (JSON.parse(raw) as LobbyListing[]).filter((l) => l.code !== entry.code) : [];
    list.unshift(entry);
    localStorage.setItem(LOBBY_STORAGE_KEY, JSON.stringify(list.slice(0, 12)));
  } catch {
    // Ignore
  }
}

function removeLocalLobby(code: string) {
  try {
    const raw = localStorage.getItem(LOBBY_STORAGE_KEY);
    if (!raw) return;
    const list = (JSON.parse(raw) as LobbyListing[]).filter((l) => l.code !== code);
    localStorage.setItem(LOBBY_STORAGE_KEY, JSON.stringify(list));
  } catch {
    // Ignore
  }
}

export class MpTransport {
  private bc: BroadcastChannel | null = null;
  private heartbeatTimer: number | null = null;
  private joinRetryTimer: number | null = null;
  private callbacks: MpTransportCallbacks;

  readonly localId: string;
  roomCode = '';
  isHost = false;
  password = '';
  connected = false;

  constructor(callbacks: MpTransportCallbacks) {
    this.callbacks = callbacks;
    this.localId = `p_${Math.random().toString(36).slice(2, 9)}`;
  }

  private generateCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let out = '';
    for (let i = 0; i < 4; i++) out += chars[Math.floor(Math.random() * chars.length)];
    return `ANT-${out}`;
  }

  private handleEnvelope(env: RoomEnvelope) {
    if (env.senderId === this.localId) return;
    if (env.targetId && env.targetId !== this.localId) return;

    if (env.msg.type === 'leave') {
      this.callbacks.onPeerDisconnected(env.msg.playerId);
      return;
    }

    if (!this.isHost && !this.connected && env.msg.type !== 'reject') {
      this.connected = true;
      if (this.joinRetryTimer !== null) {
        window.clearInterval(this.joinRetryTimer);
        this.joinRetryTimer = null;
      }
      this.callbacks.onStatus(`Подключено онлайн к ${this.roomCode}!`);
    }

    this.callbacks.onMessage(env.msg, env.senderId);
  }

  /** Host creates an ONLINE room visible worldwide in the Open Lobbies list! */
  createRoom(opts: {
    hostNick: string;
    mpMode: MpMode;
    levelId: string;
    password?: string;
    getListingMeta: () => { playerCount: number; inGame: boolean; levelId: string; mpMode: MpMode };
  }): string {
    this.close();
    this.isHost = true;
    this.roomCode = this.generateCode();
    this.password = (opts.password || '').trim();
    this.connected = true;

    onlineDirectory.ensureConnected();
    onlineDirectory.joinRoomChannel(this.roomCode, (env) => this.handleEnvelope(env));

    // Offline same-browser backup
    try {
      this.bc = new BroadcastChannel(`sugar_ants_room_${this.roomCode}`);
      this.bc.onmessage = (ev) => {
        if (!onlineDirectory.isConnected()) {
          this.handleEnvelope(ev.data as RoomEnvelope);
        }
      };
    } catch {
      // Ignore
    }

    const publishHeartbeat = () => {
      const meta = opts.getListingMeta();
      const entry: LobbyListing = {
        code: this.roomCode,
        hostNick: opts.hostNick,
        mpMode: meta.mpMode,
        levelId: meta.levelId,
        hasPassword: this.password.length > 0,
        playerCount: meta.playerCount,
        maxPlayers: meta.mpMode === 'coop' ? 10 : 2,
        inGame: meta.inGame,
        updatedAt: Date.now()
      };
      upsertLocalLobby(entry);
      onlineDirectory.publishLobby(entry);
      this.callbacks.onStatus(
        onlineDirectory.isConnected()
          ? `🌐 Онлайн-лобби открыто • ${this.roomCode}`
          : `⏳ Подключение к онлайн-серверу… (${this.roomCode})`
      );
    };

    publishHeartbeat();
    this.heartbeatTimer = window.setInterval(publishHeartbeat, 5000);
    return this.roomCode;
  }

  /** Guest joins an online (or local) room by code */
  joinRoom(rawCode: string, player: MpPlayerInfo, password = '') {
    this.close();
    const cleaned = rawCode.trim().toUpperCase();
    const code = cleaned.startsWith('ANT-') ? cleaned : `ANT-${cleaned}`;

    this.isHost = false;
    this.roomCode = code;
    this.connected = false;
    this.callbacks.onStatus(`Подключение онлайн к ${code}…`);

    onlineDirectory.ensureConnected();
    onlineDirectory.joinRoomChannel(code, (env) => this.handleEnvelope(env));

    try {
      this.bc = new BroadcastChannel(`sugar_ants_room_${code}`);
      this.bc.onmessage = (ev) => {
        if (!onlineDirectory.isConnected()) {
          this.handleEnvelope(ev.data as RoomEnvelope);
        }
      };
    } catch {
      // Ignore
    }

    const hello: MpMessage = { type: 'hello', player, password: password.trim() };
    const sendHello = () => {
      if (this.connected) return;
      this.send(hello);
    };
    sendHello();

    // Retry hello every 1.2s until host responds with lobby_state / late_sync
    let attempts = 0;
    this.joinRetryTimer = window.setInterval(() => {
      attempts++;
      if (this.connected || attempts > 8) {
        if (this.joinRetryTimer !== null) {
          window.clearInterval(this.joinRetryTimer);
          this.joinRetryTimer = null;
        }
        return;
      }
      sendHello();
    }, 1200);
  }

  send(msg: MpMessage, _excludePeerId?: string) {
    if (!this.roomCode) return;
    const env: RoomEnvelope = { senderId: this.localId, msg };
    if (onlineDirectory.isConnected()) {
      onlineDirectory.publishRoom(this.roomCode, env);
    } else if (this.bc) {
      this.bc.postMessage(env);
    }
  }

  sendTo(peerId: string, msg: MpMessage) {
    if (!this.roomCode) return;
    const env: RoomEnvelope = { senderId: this.localId, targetId: peerId, msg };
    if (onlineDirectory.isConnected()) {
      onlineDirectory.publishRoom(this.roomCode, env);
    } else if (this.bc) {
      this.bc.postMessage(env);
    }
  }

  close() {
    if (this.roomCode) {
      if (this.connected) {
        this.send({ type: 'leave', playerId: this.localId });
      }
      if (this.isHost) {
        removeLocalLobby(this.roomCode);
        onlineDirectory.unpublishLobby(this.roomCode);
      }
      onlineDirectory.leaveRoomChannel(this.roomCode);
    }
    if (this.heartbeatTimer !== null) {
      window.clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    if (this.joinRetryTimer !== null) {
      window.clearInterval(this.joinRetryTimer);
      this.joinRetryTimer = null;
    }
    this.connected = false;
    if (this.bc) {
      try {
        this.bc.close();
      } catch {
        // Ignore
      }
      this.bc = null;
    }
  }
}
