import Peer, { DataConnection } from 'peerjs';
import { PlayableAntId } from '../core/types';

export type MpMode = 'versus' | 'coop';

export type MpMessage =
  | { type: 'start'; seed: number; levelId: string; mpMode: MpMode }
  | { type: 'spawn'; owner: 1 | 2; antType: PlayableAntId; x: number; y: number; angle: number }
  | { type: 'dig'; x: number; y: number; radius: number; damage: number; owner: 1 | 2 }
  | { type: 'sugar_win'; winner: 1 | 2 }
  | { type: 'rematch'; seed: number; levelId: string; mpMode: MpMode };

export interface MpTransportCallbacks {
  onStatus: (status: string, connected: boolean) => void;
  onMessage: (msg: MpMessage) => void;
  onPeerConnected: () => void;
  onPeerDisconnected: () => void;
}

const PEER_PREFIX = 'sugar-ants-room-';

export class MpTransport {
  private peer: Peer | null = null;
  private conn: DataConnection | null = null;
  private bc: BroadcastChannel | null = null;
  private callbacks: MpTransportCallbacks;

  roomCode = '';
  isHost = false;
  connected = false;

  constructor(callbacks: MpTransportCallbacks) {
    this.callbacks = callbacks;
  }

  private generateCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let out = '';
    for (let i = 0; i < 4; i++) {
      out += chars[Math.floor(Math.random() * chars.length)];
    }
    return `ANT-${out}`;
  }

  /** Host creates a room (works over WebRTC PeerJS online AND BroadcastChannel across local tabs!) */
  createRoom(): string {
    this.close();
    this.isHost = true;
    this.roomCode = this.generateCode();
    this.connected = false;

    this.callbacks.onStatus(`Ожидание игрока… Код: ${this.roomCode}`, false);

    // 1. Local same-browser BroadcastChannel fallback (instant 2-tab play!)
    try {
      this.bc = new BroadcastChannel(`sugar_ants_${this.roomCode}`);
      this.bc.onmessage = (ev) => {
        const data = ev.data as { from: 'host' | 'guest'; payload: MpMessage | { type: 'join_local' } };
        if (data.from === 'host') return;
        if (data.payload.type === 'join_local') {
          if (!this.connected) {
            this.connected = true;
            this.callbacks.onStatus('Игрок подключился (локально)!', true);
            this.callbacks.onPeerConnected();
          }
          return;
        }
        this.callbacks.onMessage(data.payload);
      };
    } catch {
      // BroadcastChannel unavailable
    }

    // 2. Online P2P via PeerJS WebRTC
    try {
      this.peer = new Peer(PEER_PREFIX + this.roomCode);
      this.peer.on('open', () => {
        if (!this.connected) {
          this.callbacks.onStatus(`Комната открыта! Код: ${this.roomCode}`, false);
        }
      });
      this.peer.on('connection', (connection) => {
        this.conn = connection;
        this.bindConn(connection);
      });
      this.peer.on('error', () => {
        // Keep local BroadcastChannel working even if public PeerJS signaling is unreachable
        if (!this.connected) {
          this.callbacks.onStatus(`Локальная комната готова (${this.roomCode})`, false);
        }
      });
    } catch {
      // Fallback to local only
    }

    return this.roomCode;
  }

  /** Guest joins an existing room by code */
  joinRoom(rawCode: string) {
    this.close();
    const code = rawCode.trim().toUpperCase().startsWith('ANT-')
      ? rawCode.trim().toUpperCase()
      : `ANT-${rawCode.trim().toUpperCase()}`;

    this.isHost = false;
    this.roomCode = code;
    this.connected = false;
    this.callbacks.onStatus(`Подключение к ${code}…`, false);

    // 1. Try local BroadcastChannel first
    try {
      this.bc = new BroadcastChannel(`sugar_ants_${code}`);
      this.bc.onmessage = (ev) => {
        const data = ev.data as { from: 'host' | 'guest'; payload: MpMessage };
        if (data.from === 'guest') return;
        if (!this.connected) {
          this.connected = true;
          this.callbacks.onStatus(`Подключено к ${code} (локально)!`, true);
          this.callbacks.onPeerConnected();
        }
        this.callbacks.onMessage(data.payload);
      };
      this.bc.postMessage({ from: 'guest', payload: { type: 'join_local' } });
    } catch {
      // Ignore
    }

    // 2. Try online PeerJS WebRTC
    try {
      this.peer = new Peer();
      this.peer.on('open', () => {
        if (!this.peer || this.connected) return;
        const connection = this.peer.connect(PEER_PREFIX + code, { reliable: true });
        this.conn = connection;
        this.bindConn(connection);
      });
      this.peer.on('error', () => {
        if (!this.connected) {
          this.callbacks.onStatus(`Ожидание ответа от ${code}…`, false);
        }
      });
    } catch {
      // Ignore
    }
  }

  private bindConn(connection: DataConnection) {
    connection.on('open', () => {
      if (!this.connected) {
        this.connected = true;
        this.callbacks.onStatus(`Подключено онлайн (${this.roomCode})!`, true);
        this.callbacks.onPeerConnected();
      }
    });
    connection.on('data', (data) => {
      this.callbacks.onMessage(data as MpMessage);
    });
    connection.on('close', () => {
      if (this.connected) {
        this.connected = false;
        this.callbacks.onStatus('Соперник отключился', false);
        this.callbacks.onPeerDisconnected();
      }
    });
  }

  send(msg: MpMessage) {
    if (this.conn && this.conn.open) {
      this.conn.send(msg);
    }
    if (this.bc) {
      this.bc.postMessage({ from: this.isHost ? 'host' : 'guest', payload: msg });
    }
  }

  close() {
    this.connected = false;
    if (this.conn) {
      try {
        this.conn.close();
      } catch {
        // Ignore
      }
      this.conn = null;
    }
    if (this.peer) {
      try {
        this.peer.destroy();
      } catch {
        // Ignore
      }
      this.peer = null;
    }
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
