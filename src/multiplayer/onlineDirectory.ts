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
  private activeRoomCode: string | null = null;
  private roomHandler: ((env: RoomEnvelope) => void) | null = null;
  private hostedLobbyCode: string | null = null;

  constructor() {
    window.addEventListener('beforeunload', () => {
      if (this.hostedLobbyCode) {
        this.unpublishLobby(this.hostedLobbyCode);
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
        connectTimeout: 6000,
        reconnectPeriod: 4000,
        keepalive: 30
      });

      this.client = client;

      client.on('connect', () => {
        this.connected = true;
        this.connecting = false;
        client.subscribe(`${LOBBY_PREFIX}+`, { qos: 0 });
        if (this.activeRoomCode) {
          client.subscribe(`${ROOM_PREFIX}${this.activeRoomCode}`, { qos: 0 });
        }
        this.notifyLobbyListeners();
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
            // Ignore malformed message
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
    for (const [code, entry] of this.onlineLobbies.entries()) {
      if (now - entry.updatedAt < 28000) {
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
    this.hostedLobbyCode = entry.code;
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
    if (this.hostedLobbyCode === code) this.hostedLobbyCode = null;
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
