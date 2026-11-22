import Peer, { DataConnection } from 'peerjs';
import { AntSkinId, PlayableAntId } from '../core/types';

export type MpMode = 'versus' | 'coop';

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
  | { type: 'lobby_state'; players: MpPlayerInfo[]; mpMode: MpMode; levelId: string; inGame: boolean; code: string }
  | { type: 'update_profile'; playerId: string; nick: string; colorIndex: number; skin: AntSkinId }
  | { type: 'chat'; msg: ChatMessage }
  | { type: 'start'; seed: number; levelId: string; mpMode: MpMode; players: MpPlayerInfo[]; width: number; height: number }
  | { type: 'late_sync'; seed: number; levelId: string; mpMode: MpMode; players: MpPlayerInfo[]; width: number; height: number; dugEvents: [number, number, number, number][] }
  | { type: 'spawn'; playerId: string; antType: PlayableAntId; x: number; y: number; angle: number }
  | { type: 'dig'; playerId: string; x: number; y: number; radius: number; damage: number }
  | { type: 'ping'; playerId: string; nick: string; colorHex: string; x: number; y: number }
  | { type: 'sugar_win'; winnerId: string; winnerNick: string }
  | { type: 'vote_start'; reason: string }
  | { type: 'vote_cast'; playerId: string; yes: boolean }
  | { type: 'coop_event'; eventId: 'sugar_rush' | 'crystal_shower' | 'wild_swarm' | 'quake' | 'royal_blessing'; seed: number }
  | { type: 'next_level'; seed: number; levelId: string; players: MpPlayerInfo[]; width: number; height: number };

export interface MpTransportCallbacks {
  onStatus: (status: string) => void;
  onMessage: (msg: MpMessage, fromPeerId: string) => void;
  onPeerDisconnected: (peerId: string) => void;
}

const PEER_PREFIX = 'sugar-ants-v2-';
const LOBBY_STORAGE_KEY = 'sugar_ants_open_lobbies_v1';

export function listOpenLobbies(): LobbyListing[] {
  try {
    const raw = localStorage.getItem(LOBBY_STORAGE_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw) as LobbyListing[];
    const now = Date.now();
    // Filter stale entries (>12s old)
    return list.filter((l) => now - l.updatedAt < 12000);
  } catch {
    return [];
  }
}

function upsertLobbyListing(entry: LobbyListing) {
  try {
    const list = listOpenLobbies().filter((l) => l.code !== entry.code);
    list.unshift(entry);
    localStorage.setItem(LOBBY_STORAGE_KEY, JSON.stringify(list.slice(0, 12)));
  } catch {
    // Ignore storage errors
  }
}

function removeLobbyListing(code: string) {
  try {
    const list = listOpenLobbies().filter((l) => l.code !== code);
    localStorage.setItem(LOBBY_STORAGE_KEY, JSON.stringify(list));
  } catch {
    // Ignore
  }
}

export class MpTransport {
  private peer: Peer | null = null;
  private hostConns = new Map<string, DataConnection>(); // Host -> Guests
  private guestConn: DataConnection | null = null;       // Guest -> Host
  private bc: BroadcastChannel | null = null;
  private heartbeatTimer: number | null = null;
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

  /** Host opens a multi-player room (up to 10 players!) */
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

    this.callbacks.onStatus(`Лобби открыто • Код: ${this.roomCode}`);

    const publishHeartbeat = () => {
      const meta = opts.getListingMeta();
      upsertLobbyListing({
        code: this.roomCode,
        hostNick: opts.hostNick,
        mpMode: meta.mpMode,
        levelId: meta.levelId,
        hasPassword: this.password.length > 0,
        playerCount: meta.playerCount,
        maxPlayers: meta.mpMode === 'coop' ? 10 : 2,
        inGame: meta.inGame,
        updatedAt: Date.now()
      });
    };
    publishHeartbeat();
    this.heartbeatTimer = window.setInterval(publishHeartbeat, 3000);

    // 1. Local multi-tab BroadcastChannel
    try {
      this.bc = new BroadcastChannel(`sugar_ants_room_${this.roomCode}`);
      this.bc.onmessage = (ev) => {
        const env = ev.data as { senderId: string; targetId?: string; msg: MpMessage };
        if (env.senderId === this.localId) return;
        if (env.targetId && env.targetId !== this.localId) return;
        this.callbacks.onMessage(env.msg, env.senderId);
      };
    } catch {
      // Ignore
    }

    // 2. Online WebRTC PeerJS Hub
    try {
      this.peer = new Peer(PEER_PREFIX + this.roomCode);
      this.peer.on('open', () => {
        this.callbacks.onStatus(`Онлайн-лобби активно • ${this.roomCode}`);
      });
      this.peer.on('connection', (conn) => {
        conn.on('open', () => {
          this.hostConns.set(conn.peer, conn);
        });
        conn.on('data', (data) => {
          this.callbacks.onMessage(data as MpMessage, conn.peer);
        });
        conn.on('close', () => {
          this.hostConns.delete(conn.peer);
          this.callbacks.onPeerDisconnected(conn.peer);
        });
      });
      this.peer.on('error', () => {
        this.callbacks.onStatus(`Локальное лобби активно • ${this.roomCode}`);
      });
    } catch {
      // Ignore
    }

    return this.roomCode;
  }

  /** Guest joins an existing room by code */
  joinRoom(rawCode: string, player: MpPlayerInfo, password = '') {
    this.close();
    const cleaned = rawCode.trim().toUpperCase();
    const code = cleaned.startsWith('ANT-') ? cleaned : `ANT-${cleaned}`;

    this.isHost = false;
    this.roomCode = code;
    this.connected = false;
    this.callbacks.onStatus(`Подключение к ${code}…`);

    const hello: MpMessage = { type: 'hello', player, password: password.trim() };

    // 1. Local BroadcastChannel
    try {
      this.bc = new BroadcastChannel(`sugar_ants_room_${code}`);
      this.bc.onmessage = (ev) => {
        const env = ev.data as { senderId: string; targetId?: string; msg: MpMessage };
        if (env.senderId === this.localId) return;
        if (env.targetId && env.targetId !== this.localId) return;
        if (!this.connected && env.msg.type !== 'reject') {
          this.connected = true;
          this.callbacks.onStatus(`Подключено к ${code}!`);
        }
        this.callbacks.onMessage(env.msg, env.senderId);
      };
      this.bc.postMessage({ senderId: this.localId, msg: hello });
    } catch {
      // Ignore
    }

    // 2. Online PeerJS WebRTC
    try {
      this.peer = new Peer();
      this.peer.on('open', () => {
        if (!this.peer || this.connected) return;
        const conn = this.peer.connect(PEER_PREFIX + code, { reliable: true });
        this.guestConn = conn;
        conn.on('open', () => {
          this.connected = true;
          this.callbacks.onStatus(`Подключено онлайн к ${code}!`);
          conn.send(hello);
        });
        conn.on('data', (data) => {
          this.callbacks.onMessage(data as MpMessage, conn.peer);
        });
        conn.on('close', () => {
          this.connected = false;
          this.callbacks.onStatus('Соединение с хостом потеряно');
          this.callbacks.onPeerDisconnected('host');
        });
      });
      this.peer.on('error', () => {
        if (!this.connected) {
          this.callbacks.onStatus(`Ожидание ответа от ${code}…`);
        }
      });
    } catch {
      // Ignore
    }
  }

  /** Broadcast to all peers (Host) or send to Host (Guest) */
  send(msg: MpMessage, excludePeerId?: string) {
    if (this.isHost) {
      for (const [peerId, conn] of this.hostConns.entries()) {
        if (peerId !== excludePeerId && conn.open) {
          conn.send(msg);
        }
      }
      if (this.bc) {
        this.bc.postMessage({ senderId: this.localId, msg });
      }
    } else {
      if (this.guestConn && this.guestConn.open) {
        this.guestConn.send(msg);
      }
      if (this.bc) {
        this.bc.postMessage({ senderId: this.localId, msg });
      }
    }
  }

  /** Host sends directly to a specific peer (e.g., late-join sync or reject) */
  sendTo(peerId: string, msg: MpMessage) {
    const conn = this.hostConns.get(peerId);
    if (conn && conn.open) {
      conn.send(msg);
    }
    if (this.bc) {
      this.bc.postMessage({ senderId: this.localId, targetId: peerId, msg });
    }
  }

  close() {
    if (this.isHost && this.roomCode) {
      removeLobbyListing(this.roomCode);
    }
    if (this.heartbeatTimer !== null) {
      window.clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    this.connected = false;
    for (const c of this.hostConns.values()) {
      try { c.close(); } catch { /* ignore */ }
    }
    this.hostConns.clear();
    if (this.guestConn) {
      try { this.guestConn.close(); } catch { /* ignore */ }
      this.guestConn = null;
    }
    if (this.peer) {
      try { this.peer.destroy(); } catch { /* ignore */ }
      this.peer = null;
    }
    if (this.bc) {
      try { this.bc.close(); } catch { /* ignore */ }
      this.bc = null;
    }
  }
}
