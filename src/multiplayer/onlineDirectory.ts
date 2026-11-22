import mqtt, { MqttClient } from 'mqtt';
import { LobbyListing, MpMessage } from './mpTransport';

const BROKERS = [
  'wss://broker.emqx.io:8084/mqtt',
  'wss://broker.hivemq.com:8884/mqtt'
];

const LOBBY_PREFIX = 'sugar-ants/v2/lobbies/';
const ROOM_PREFIX = 'sugar-ants/v2/rooms/';
const textDecoder = new TextDecoder();

export interface RoomEnvelope {
  msgId?: string;
  senderId: string;
  targetId?: string;
  msg: MpMessage;
}

interface TrackedLobby {
  entry: LobbyListing;
  receivedAt: number;
  verified: boolean;
  lastSeq: number;
  lastUpdatedAt: number;
}

class OnlineDirectory {
  private client: MqttClient | null = null;
  private brokerIdx = 0;
  private connected = false;
  private connecting = false;

  private onlineLobbies = new Map<string, TrackedLobby>();
  private lobbyListeners = new Set<() => void>();
  private connectListeners = new Set<() => void>();
  private activeRoomCode: string | null = null;
  private roomHandler: ((env: RoomEnvelope) => void) | null = null;
  private hostedLobbyEntry: LobbyListing | null = null;
  private pendingPublishes: { code: string; env: RoomEnvelope; qos: 0 | 1 }[] = [];

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

  ensureLiveConnection() {
    if (this.connected) {
      if (this.activeRoomCode && this.client) {
        this.client.subscribe(`${ROOM_PREFIX}${this.activeRoomCode}`, { qos: 0 });
      }
      return;
    }
    if (this.client) {
      try {
        this.client.reconnect();
      } catch {
        this.connecting = false;
        this.connectToBroker(this.brokerIdx);
      }
    } else {
      this.ensureConnected();
    }
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
        // Flush any queued messages sent before MQTT finished handshaking!
        if (this.pendingPublishes.length > 0) {
          const queued = this.pendingPublishes.splice(0, this.pendingPublishes.length);
          for (const item of queued) {
            client.publish(`${ROOM_PREFIX}${item.code}`, JSON.stringify(item.env), { qos: item.qos });
          }
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
              const now = Date.now();
              const skew = Math.abs(now - entry.updatedAt);
              const prev = this.onlineLobbies.get(entry.code);
              const seq = entry.seq ?? 0;
              const isNewHeartbeat =
                prev !== undefined &&
                (entry.updatedAt !== prev.lastUpdatedAt || (seq > 0 && seq !== prev.lastSeq));

              // Sweep clearly dead retained zombies (>90s old on normal clocks) off the broker
              if (!prev && now - entry.updatedAt > 90000) {
                client.publish(`${LOBBY_PREFIX}${code}`, '', { retain: true, qos: 0 });
                return;
              }

              // Clock-skew immune liveness: if timestamp is fresh (within 25s of local clock) OR
              // we observed a second live heartbeat, mark verified! Dead future-clocked zombies stay hidden.
              const verified = skew <= 25000 || isNewHeartbeat || Boolean(prev?.verified && isNewHeartbeat);

              this.onlineLobbies.set(entry.code, {
                entry,
                receivedAt: now,
                verified,
                lastSeq: seq,
                lastUpdatedAt: entry.updatedAt
              });
              this.notifyLobbyListeners();
            }
          } catch {
            // Ignore malformed
          }
        } else if (
          this.activeRoomCode &&
          topic === `${ROOM_PREFIX}${this.activeRoomCode}` &&
          this.roomHandler
        ) {
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
    // Strict 30-second heartbeat TTL measured in local receive time (immune to clock skew & zombie retained lobbies!)
    for (const [code, tracked] of this.onlineLobbies.entries()) {
      const ageSinceReceived = now - tracked.receivedAt;
      if (ageSinceReceived > 30000) {
        // No heartbeat for 30s (6 missed beats!) -> delete locally and sweep dead retained topic off broker!
        if (this.hostedLobbyEntry?.code !== code && this.client && this.connected) {
          this.client.publish(`${LOBBY_PREFIX}${code}`, '', { retain: true, qos: 0 });
        }
        this.onlineLobbies.delete(code);
        continue;
      }
      if (tracked.verified) {
        fresh.push(tracked.entry);
      }
    }
    fresh.sort((a, b) => b.updatedAt - a.updatedAt);
    return fresh;
  }

  publishLobby(entry: LobbyListing) {
    this.ensureConnected();
    this.hostedLobbyEntry = entry;
    const now = Date.now();
    this.onlineLobbies.set(entry.code, {
      entry,
      receivedAt: now,
      verified: true,
      lastSeq: entry.seq ?? 0,
      lastUpdatedAt: entry.updatedAt
    });
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

  publishRoom(code: string, env: RoomEnvelope, qos: 0 | 1 = 0) {
    if (this.client && this.connected) {
      this.client.publish(`${ROOM_PREFIX}${code}`, JSON.stringify(env), { qos });
    } else {
      this.ensureConnected();
      // Never lose critical packets (chat, hello, late_sync, vote, start, next_level, cells_clear)
      if (env.msg.type !== 'ants_sync') {
        if (this.pendingPublishes.length >= 50) {
          const dropIdx = this.pendingPublishes.findIndex((p) => p.env.msg.type === 'cells_clear');
          if (dropIdx >= 0) this.pendingPublishes.splice(dropIdx, 1);
          else this.pendingPublishes.shift();
        }
        this.pendingPublishes.push({ code, env, qos });
      }
    }
  }
}

export const onlineDirectory = new OnlineDirectory();
