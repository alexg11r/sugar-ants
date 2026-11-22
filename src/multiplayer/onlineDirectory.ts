import mqtt, { MqttClient } from 'mqtt';
import { LobbyListing, MpMessage } from './mpTransport';

const BROKERS = [
  'wss://broker.emqx.io:8084/mqtt',
  'wss://broker.hivemq.com:8884/mqtt'
];

const LOBBY_PREFIX = 'sugar-ants/v1/lobbies/';
const ROOM_PREFIX = 'sugar-ants/v1/rooms/';
const textDecoder = new TextDecoder();

export interface RoomEnvelope {
  msgId?: string;
  senderId: string;
  targetId?: string;
  msg: MpMessage;
}

class OnlineDirectory {
  private client: MqttClient | null = null;
  private brokerIdx = 0;
  private connected = false;
  private connecting = false;

  private onlineLobbies = new Map<string, LobbyListing>();
  private lobbyListeners = new Set<() => void>();
  private connectListeners = new Set<() => void>();
  private activeRoomCode: string | null = null;
  private roomHandler: ((env: RoomEnvelope) => void) | null = null;
  private hostedLobbyEntry: LobbyListing | null = null;

  constructor() {
    window.addEventListener('beforeunload', () => {
      if (this.hostedLobbyEntry) {
        this.unpublishLobby(this.hostedLobbyEntry.code);
      }
    });
  }

  isConnected(): boolean {
    return this.connected;
  }

  ensureConnected() {
    if (this.connected || this.connecting) return;
    this.connectToBroker(this.brokerIdx);
  }

  private connectToBroker(idx: number) {
    if (this.client) {
      try {
        this.client.end(true);
      } catch {
        // Ignore
      }
      this.client = null;
    }

    this.connecting = true;
    const url = BROKERS[idx % BROKERS.length];

    try {
      const client = mqtt.connect(url, {
        clientId: `sa_${Math.random().toString(36).slice(2, 10)}`,
        clean: true,
        connectTimeout: 8000,
        reconnectPeriod: 2500,
        keepalive: 45
      });

      this.client = client;

      client.on('connect', () => {
        this.connected = true;
        this.connecting = false;
        client.subscribe(`${LOBBY_PREFIX}+`, { qos: 0 });
        if (this.activeRoomCode) {
          client.subscribe(`${ROOM_PREFIX}${this.activeRoomCode}`, { qos: 0 });
        }
        // Immediately re-publish hosted lobby on reconnect so it never vanishes!
        if (this.hostedLobbyEntry) {
          const fresh = { ...this.hostedLobbyEntry, updatedAt: Date.now() };
          this.hostedLobbyEntry = fresh;
          client.publish(`${LOBBY_PREFIX}${fresh.code}`, JSON.stringify(fresh), {
            retain: true,
            qos: 0
          });
        }
        this.notifyLobbyListeners();
        for (const fn of this.connectListeners) fn();
      });

      client.on('message', (topic, payload) => {
        const text =
          typeof payload === 'string'
            ? payload
            : textDecoder.decode(payload as Uint8Array);

        if (topic.startsWith(LOBBY_PREFIX)) {
          const code = topic.slice(LOBBY_PREFIX.length);
          if (!text) {
            this.onlineLobbies.delete(code);
            this.notifyLobbyListeners();
            return;
          }
          try {
            const entry = JSON.parse(text) as LobbyListing;
            if (entry && entry.code) {
              this.onlineLobbies.set(entry.code, entry);
              this.notifyLobbyListeners();
            }
          } catch {
            // Ignore malformed
          }
        } else if (topic.startsWith(ROOM_PREFIX) && this.roomHandler) {
          try {
            const env = JSON.parse(text) as RoomEnvelope;
            if (env && env.msg) {
              this.roomHandler(env);
            }
          } catch {
            // Ignore
          }
        }
      });

      client.on('error', () => {
        if (!this.connected) {
          this.connecting = false;
          this.brokerIdx = (this.brokerIdx + 1) % BROKERS.length;
        }
      });

      client.on('close', () => {
        this.connected = false;
      });
    } catch {
      this.connecting = false;
    }
  }

  onConnected(fn: () => void): () => void {
    this.connectListeners.add(fn);
    return () => {
      this.connectListeners.delete(fn);
    };
  }

  onLobbiesUpdated(fn: () => void): () => void {
    this.lobbyListeners.add(fn);
    this.ensureConnected();
    return () => {
      this.lobbyListeners.delete(fn);
    };
  }

  private notifyLobbyListeners() {
    for (const fn of this.lobbyListeners) fn();
  }

  getOnlineLobbies(): LobbyListing[] {
    const now = Date.now();
    const fresh: LobbyListing[] = [];
    // Generous 90-second TTL so mobile backgrounding or brief reconnects never drop lobbies!
    for (const [code, entry] of this.onlineLobbies.entries()) {
      if (now - entry.updatedAt < 90000) {
        fresh.push(entry);
      } else {
        this.onlineLobbies.delete(code);
      }
    }
    fresh.sort((a, b) => b.updatedAt - a.updatedAt);
    return fresh;
  }

  publishLobby(entry: LobbyListing) {
    this.ensureConnected();
    this.hostedLobbyEntry = entry;
    this.onlineLobbies.set(entry.code, entry);
    if (this.client && this.connected) {
      this.client.publish(`${LOBBY_PREFIX}${entry.code}`, JSON.stringify(entry), {
        retain: true,
        qos: 0
      });
    }
    this.notifyLobbyListeners();
  }

  unpublishLobby(code: string) {
    if (this.hostedLobbyEntry?.code === code) this.hostedLobbyEntry = null;
    this.onlineLobbies.delete(code);
    if (this.client && this.connected) {
      this.client.publish(`${LOBBY_PREFIX}${code}`, '', { retain: true, qos: 0 });
    }
    this.notifyLobbyListeners();
  }

  joinRoomChannel(code: string, handler: (env: RoomEnvelope) => void) {
    this.ensureConnected();
    if (this.activeRoomCode && this.activeRoomCode !== code && this.client && this.connected) {
      this.client.unsubscribe(`${ROOM_PREFIX}${this.activeRoomCode}`);
    }
    this.activeRoomCode = code;
    this.roomHandler = handler;
    if (this.client && this.connected) {
      this.client.subscribe(`${ROOM_PREFIX}${code}`, { qos: 0 });
    }
  }

  leaveRoomChannel(code: string) {
    if (this.activeRoomCode === code) {
      if (this.client && this.connected) {
        this.client.unsubscribe(`${ROOM_PREFIX}${code}`);
      }
      this.activeRoomCode = null;
      this.roomHandler = null;
    }
  }

  publishRoom(code: string, env: RoomEnvelope) {
    if (this.client && this.connected) {
      this.client.publish(`${ROOM_PREFIX}${code}`, JSON.stringify(env), { qos: 0 });
    }
  }
}

export const onlineDirectory = new OnlineDirectory();
