import { subscribeBackgroundTick } from '../core/bgTicker';
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
  seq?: number;
}

export interface SyncedVotePayload {
  reason: string;
  options: string[];
  votes: Record<string, string>;
  timeLeft: number;
}

export type MpMessage =
  | { type: 'hello'; player: MpPlayerInfo; password?: string }
  | { type: 'resync_req'; playerId: string }
  | { type: 'reject'; reason: string }
  | {
      type: 'lobby_state';
      players: MpPlayerInfo[];
      mpMode: MpMode;
      levelId: string;
      mapSizePreset: MpMapSizePreset;
      inGame: boolean;
      code: string;
      chatHistory?: ChatMessage[];
    }
  | { type: 'players_update'; players: MpPlayerInfo[] }
  | { type: 'update_profile'; playerId: string; nick: string; colorIndex: number; skin: AntSkinId }
  | { type: 'chat'; msg: ChatMessage }
  | { type: 'start'; seed: number; levelId: string; mpMode: MpMode; players: MpPlayerInfo[]; width: number; height: number }
  | {
      type: 'late_sync';
      syncId?: string;
      seed: number;
      levelId: string;
      mpMode: MpMode;
      players: MpPlayerInfo[];
      width: number;
      height: number;
      emptyRle: string;
      rleChunksTotal?: number;
      sugarFound: boolean;
      activeVote: SyncedVotePayload | null;
      chatHistory: ChatMessage[];
    }
  | { type: 'rle_chunk'; syncId: string; index: number; total: number; data: string }
  | { type: 'spawn'; antId?: number; playerId: string; antType: PlayableAntId; x: number; y: number; angle: number }
  | { type: 'dig'; playerId: string; x: number; y: number; radius: number; damage: number }
  | { type: 'cells_clear'; indices: number[]; ownerId: string }
  | { type: 'ants_sync'; ownerId: string; ants: [number, number, number, number, number][] }
  | { type: 'ping'; playerId: string; nick: string; colorHex: string; x: number; y: number }
  | { type: 'sugar_win'; winnerId: string; winnerNick: string }
  | { type: 'vote_start'; reason: string; options: string[]; durationSec: number }
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
  | { type: 'leave'; playerId: string; isHost: boolean };

export interface MpTransportCallbacks {
  onStatus: (status: string) => void;
  onMessage: (msg: MpMessage, fromPeerId: string) => void;
  onPeerDisconnected: (peerId: string, wasHost: boolean) => void;
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
        if (now - l.updatedAt >= -15000 && now - l.updatedAt < 18000) merged.set(l.code, l);
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
  private unsubHeartbeatTick: (() => void) | null = null;
  private lastHeartbeatMs = 0;
  private joinRetryTimer: number | null = null;
  private unsubConnect: (() => void) | null = null;
  private seenMsgIds = new Set<string>();
  private msgSeq = 0;
  private callbacks: MpTransportCallbacks;

  private static isCriticalMsg(msg: MpMessage): boolean {
    return (
      msg.type !== 'ants_sync' &&
      msg.type !== 'cells_clear' &&
      msg.type !== 'dig' &&
      msg.type !== 'spawn' &&
      msg.type !== 'ping'
    );
  }

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

    // Deduplicate across MQTT WSS + BroadcastChannel
    if (env.msgId) {
      if (this.seenMsgIds.has(env.msgId)) return;
      this.seenMsgIds.add(env.msgId);
      if (this.seenMsgIds.size > 400) {
        const first = this.seenMsgIds.values().next().value;
        if (first) this.seenMsgIds.delete(first);
      }
    }

    if (env.msg.type === 'leave') {
      this.callbacks.onPeerDisconnected(env.msg.playerId, env.msg.isHost);
      return;
    }

    // Only consider Guest handshake complete when Host actually acknowledges via lobby_state / start / late_sync!
    // Otherwise live ants_sync / cells_clear packets from an in-progress match would cancel hello retries!
    const isHandshakeAck =
      env.msg.type === 'lobby_state' ||
      env.msg.type === 'start' ||
      env.msg.type === 'late_sync';
    if (!this.isHost && !this.connected && isHandshakeAck) {
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

    // Same-browser instant BroadcastChannel (always active alongside MQTT, deduplicated by msgId!)
    try {
      this.bc = new BroadcastChannel(`sugar_ants_room_${this.roomCode}`);
      this.bc.onmessage = (ev) => {
        this.handleEnvelope(ev.data as RoomEnvelope);
      };
    } catch {
      // Ignore
    }

    let heartbeatSeq = 0;
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
        updatedAt: Date.now(),
        seq: ++heartbeatSeq
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
    this.lastHeartbeatMs = Date.now();
    this.unsubHeartbeatTick = subscribeBackgroundTick(() => {
      const now = Date.now();
      if (now - this.lastHeartbeatMs >= 5000) {
        this.lastHeartbeatMs = now;
        publishHeartbeat();
      }
    });
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
        this.handleEnvelope(ev.data as RoomEnvelope);
      };
    } catch {
      // Ignore
    }

    const hello: MpMessage = { type: 'hello', player, password: password.trim() };
    const sendHello = () => {
      if (this.connected) return;
      this.send(hello);
    };

    // Immediately send hello as soon as MQTT finishes connecting (crucial on mobile!)
    this.unsubConnect = onlineDirectory.onConnected(() => {
      if (!this.connected) {
        onlineDirectory.joinRoomChannel(code, (env) => this.handleEnvelope(env));
        setTimeout(sendHello, 250);
      }
    });

    setTimeout(sendHello, 60);

    // Retry hello every 1.0s until host actually acknowledges with lobby_state / start / late_sync
    let attempts = 0;
    this.joinRetryTimer = window.setInterval(() => {
      attempts++;
      if (this.connected || attempts > 20) {
        if (this.joinRetryTimer !== null) {
          window.clearInterval(this.joinRetryTimer);
          this.joinRetryTimer = null;
        }
        return;
      }
      sendHello();
    }, 1000);
  }

  send(msg: MpMessage, _excludePeerId?: string) {
    if (!this.roomCode) return;
    const msgId = `${this.localId}_${++this.msgSeq}`;
    const env: RoomEnvelope = { msgId, senderId: this.localId, msg };
    const qos: 0 | 1 = MpTransport.isCriticalMsg(msg) ? 1 : 0;
    onlineDirectory.publishRoom(this.roomCode, env, qos);
    if (this.bc) {
      this.bc.postMessage(env);
    }
  }

  sendTo(peerId: string, msg: MpMessage) {
    if (!this.roomCode) return;
    const msgId = `${this.localId}_${++this.msgSeq}`;
    const env: RoomEnvelope = { msgId, senderId: this.localId, targetId: peerId, msg };
    const qos: 0 | 1 = MpTransport.isCriticalMsg(msg) ? 1 : 0;
    onlineDirectory.publishRoom(this.roomCode, env, qos);
    if (this.bc) {
      this.bc.postMessage(env);
    }
  }

  close() {
    if (this.unsubConnect) {
      this.unsubConnect();
      this.unsubConnect = null;
    }
    if (this.roomCode) {
      if (this.connected) {
        this.send({ type: 'leave', playerId: this.localId, isHost: this.isHost });
      }
      if (this.isHost) {
        removeLocalLobby(this.roomCode);
        onlineDirectory.unpublishLobby(this.roomCode);
      }
      onlineDirectory.leaveRoomChannel(this.roomCode);
    }
    if (this.unsubHeartbeatTick) {
      this.unsubHeartbeatTick();
      this.unsubHeartbeatTick = null;
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
