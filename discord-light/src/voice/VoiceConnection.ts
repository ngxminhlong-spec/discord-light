// @ts-nocheck
import WebSocket from 'ws';
import { EventEmitter } from 'node:events';
import { VoiceOpcodes, VoiceEncryptionModes } from './VoiceOpcodes.js';
import { VoiceUDP } from './VoiceUDP.js';
import type { Client } from '../client/Client.js';

interface VoiceServerUpdate {
  token: string;
  guild_id: string;
  endpoint: string;
}

interface VoiceStateUpdate {
  guild_id: string;
  channel_id: string | null;
  user_id: string;
  session_id: string;
}

interface VoicePayload {
  op: number;
  d?: unknown;
}

let sodium: typeof import('sodium-native') | null = null;
try {
  sodium = await import('sodium-native');
} catch {
  // sodium-native is optional
}

export class VoiceConnection extends EventEmitter {
  #client: Client;
  #guildId: string;
  #channelId: string;
  #sessionId: string;
  #token: string;
  #endpoint: string;
  #ws: WebSocket | null = null;
  #udp: VoiceUDP | null = null;
  #heartbeatInterval: NodeJS.Timeout | null = null;
  #ssrc = 0;
  #secretKey: Uint8Array | null = null;
  #mode: string | null = null;
  #sequence = 0;
  #timestamp = 0;
  #nonce = 0;
  #speaking = false;
  #connected = false;
  #ready = false;

  constructor(client: Client, guildId: string, channelId: string) {
    super();
    this.#client = client;
    this.#guildId = guildId;
    this.#channelId = channelId;
    this.#sessionId = '';
    this.#token = '';
    this.#endpoint = '';
  }

  get guildId(): string {
    return this.#guildId;
  }

  get channelId(): string {
    return this.#channelId;
  }

  get connected(): boolean {
    return this.#connected;
  }

  get ready(): boolean {
    return this.#ready;
  }

  async connect(): Promise<void> {
    if (this.#connected) return;

    const [voiceState, voiceServer] = await Promise.all([
      this.#awaitVoiceState(),
      this.#awaitVoiceServer(),
    ]);

    this.#sessionId = voiceState.session_id;
    this.#token = voiceServer.token;
    this.#endpoint = voiceServer.endpoint;

    const url = `wss://${this.#endpoint}?v=4`;
    this.#ws = new WebSocket(url);

    this.#ws.on('open', () => this.#sendIdentify());
    this.#ws.on('message', (data) => this.#onMessage(data));
    this.#ws.on('close', (code, reason) => this.#onClose(code, reason));
    this.#ws.on('error', (err) => this.emit('error', err));

    this.#connected = true;
  }

  #sendIdentify(): void {
    this.#send({
      op: VoiceOpcodes.IDENTIFY,
      d: {
        server_id: this.#guildId,
        user_id: this.#client.user?.id,
        session_id: this.#sessionId,
        token: this.#token,
      },
    });
  }

  #onMessage(data: WebSocket.RawData): void {
    let payload: VoicePayload;
    try {
      payload = JSON.parse(data.toString());
    } catch {
      return;
    }

    switch (payload.op) {
      case VoiceOpcodes.HELLO:
        this.#startHeartbeat((payload.d as { heartbeat_interval: number }).heartbeat_interval);
        break;

      case VoiceOpcodes.READY:
        this.#handleReady(payload.d as { ssrc: number; ip: string; port: number; modes: string[] });
        break;

      case VoiceOpcodes.SESSION_DESCRIPTION:
        this.#secretKey = new Uint8Array((payload.d as { secret_key: number[] }).secret_key);
        this.#ready = true;
        this.emit('ready');
        break;

      case VoiceOpcodes.HEARTBEAT_ACK:
        break;

      case VoiceOpcodes.SPEAKING:
        this.emit('speaking', payload.d);
        break;
    }
  }

  async #handleReady(data: { ssrc: number; ip: string; port: number; modes: string[] }): Promise<void> {
    this.#ssrc = data.ssrc;

    const preferredModes = [
      VoiceEncryptionModes.AEAD_AES256_GCM_RTPSIZE,
      VoiceEncryptionModes.AEAD_AES256_GCM,
      VoiceEncryptionModes.XSALSA20_POLY1305_LITE,
      VoiceEncryptionModes.XSALSA20_POLY1305_SUFFIX,
      VoiceEncryptionModes.XSALSA20_POLY1305,
    ];

    this.#mode = preferredModes.find(m => data.modes.includes(m)) ?? data.modes[0];

    this.#udp = new VoiceUDP(this.#ssrc);
    await this.#udp.bind();
    this.#udp.performIPDiscovery(data.ip, data.port);

    const { ip, port } = await new Promise<{ ip: string; port: number }>((resolve) => {
      this.#udp!.once('ipDiscovered', resolve);
    });

    this.#send({
      op: VoiceOpcodes.SELECT_PROTOCOL,
      d: {
        protocol: 'udp',
        data: {
          address: ip,
          port: port,
          mode: this.#mode,
        },
      },
    });
  }

  #startHeartbeat(interval: number): void {
    this.#heartbeatInterval = setInterval(() => {
      this.#send({
        op: VoiceOpcodes.HEARTBEAT,
        d: Date.now(),
      });
    }, interval);
  }

  #onClose(code: number, reason: Buffer): void {
    this.#cleanup();
    this.emit('close', code, reason.toString());
  }

  #cleanup(): void {
    if (this.#heartbeatInterval) {
      clearInterval(this.#heartbeatInterval);
      this.#heartbeatInterval = null;
    }
    this.#udp?.close();
    this.#udp = null;
    this.#ws?.removeAllListeners();
    this.#ws = null;
    this.#connected = false;
    this.#ready = false;
  }

  setSpeaking(speaking: boolean): void {
    this.#speaking = speaking;
    this.#send({
      op: VoiceOpcodes.SPEAKING,
      d: {
        speaking: speaking ? 1 : 0,
        delay: 0,
        ssrc: this.#ssrc,
      },
    });
  }

  sendAudioPacket(opusPacket: Buffer): void {
    if (!this.#ready || !this.#udp || !this.#secretKey) return;

    this.#sequence = (this.#sequence + 1) & 0xFFFF;
    this.#timestamp += 960;

    const rtpHeader = Buffer.alloc(12);
    rtpHeader[0] = 0x80;
    rtpHeader[1] = 0x78;
    rtpHeader.writeUInt16BE(this.#sequence, 2);
    rtpHeader.writeUInt32BE(this.#timestamp, 4);
    rtpHeader.writeUInt32BE(this.#ssrc, 8);

    let nonce: Buffer;
    let encrypted: Buffer;

    if (this.#mode === VoiceEncryptionModes.XSALSA20_POLY1305_LITE) {
      nonce = Buffer.alloc(4);
      nonce.writeUInt32BE(this.#nonce++);
      const fullNonce = Buffer.alloc(24);
      nonce.copy(fullNonce);
      encrypted = this.#encryptXSalsa20(opusPacket, fullNonce);
      const packet = Buffer.concat([rtpHeader, encrypted, nonce]);
      this.#udp.send(packet);
    } else if (this.#mode === VoiceEncryptionModes.XSALSA20_POLY1305_SUFFIX) {
      nonce = Buffer.alloc(24);
      crypto.randomFillSync(nonce);
      encrypted = this.#encryptXSalsa20(opusPacket, nonce);
      const packet = Buffer.concat([rtpHeader, encrypted, nonce]);
      this.#udp.send(packet);
    } else {
      nonce = Buffer.alloc(24);
      rtpHeader.copy(nonce);
      encrypted = this.#encryptXSalsa20(opusPacket, nonce);
      const packet = Buffer.concat([rtpHeader, encrypted]);
      this.#udp.send(packet);
    }
  }

  #encryptXSalsa20(data: Buffer, nonce: Buffer): Buffer {
    if (!sodium || !this.#secretKey) {
      throw new Error('sodium-native is required for voice encryption. Install it with: npm install sodium-native');
    }
    const encrypted = Buffer.alloc(data.length + sodium.crypto_secretbox_MACBYTES);
    sodium.crypto_secretbox_easy(encrypted, data, nonce, this.#secretKey);
    return encrypted;
  }

  disconnect(): void {
    this.#cleanup();
    this.#client.rest.patch(`/guilds/${this.#guildId}/members/@me`, {
      channel_id: null,
    }).catch(() => {});
  }

  #send(payload: VoicePayload): void {
    if (this.#ws?.readyState === WebSocket.OPEN) {
      this.#ws.send(JSON.stringify(payload));
    }
  }

  #awaitVoiceState(): Promise<VoiceStateUpdate> {
    return new Promise((resolve) => {
      const handler = (data: VoiceStateUpdate) => {
        if (data.guild_id === this.#guildId && data.user_id === this.#client.user?.id) {
          this.#client.off('voiceStateUpdate', handler as (...args: unknown[]) => void);
          resolve(data);
        }
      };
      this.#client.on('voiceStateUpdate', handler as (...args: unknown[]) => void);
      this.#client.shardManager?.getShard(0)?.sendVoiceStateUpdate(this.#guildId, this.#channelId);
    });
  }

  #awaitVoiceServer(): Promise<VoiceServerUpdate> {
    return new Promise((resolve) => {
      const handler = (data: VoiceServerUpdate) => {
        if (data.guild_id === this.#guildId) {
          this.#client.off('voiceServerUpdate', handler as (...args: unknown[]) => void);
          resolve(data);
        }
      };
      this.#client.on('voiceServerUpdate', handler as (...args: unknown[]) => void);
    });
  }
}
