import { createSocket, type RemoteInfo } from 'node:dgram';
import { EventEmitter } from 'node:events';

// Pre-calculated constants
const IP_DISCOVERY_PACKET_SIZE = 70;
const IP_DISCOVERY_TYPE = 1;
const BUFFER_SIZE = 4096;

export class VoiceUDP extends EventEmitter {
  #socket = createSocket('udp4');
  #ssrc: number;
  #remote?: { ip: string; port: number };
  #ready = false;
  #sendBuffer: Buffer[] = []; // Buffer for batching sends
  #isFlushing = false;

  constructor(ssrc: number) {
    super();
    this.#ssrc = ssrc;

    // Set socket buffer sizes for better throughput
    this.#socket.setRecvBufferSize(BUFFER_SIZE * 4);
    this.#socket.setSendBufferSize(BUFFER_SIZE * 4);

    this.#socket.on('message', (msg, rinfo) => this.#onMessage(msg, rinfo));
    this.#socket.on('error', (err) => this.emit('error', err));
  }

  /**
   * Process incoming messages
   */
  #onMessage(msg: Buffer, rinfo: RemoteInfo): void {
    // IP Discovery response
    if (!this.#ready && msg.length === IP_DISCOVERY_PACKET_SIZE) {
      const ip = msg.subarray(4, 68).toString('utf8').replace(/\x00/g, '');
      const port = msg.readUInt16BE(68);
      this.#ready = true;
      this.emit('ipDiscovered', { ip, port });
      return;
    }

    // Audio packet
    this.emit('packet', msg, rinfo);
  }

  /**
   * Bind socket to local address
   */
  bind(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.#socket.bind(0, '0.0.0.0', (err?: Error) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  /**
   * Perform IP discovery for voice connection
   */
  performIPDiscovery(address: string, port: number): void {
    this.#remote = { ip: address, port };
    const packet = Buffer.alloc(IP_DISCOVERY_PACKET_SIZE);
    packet.writeUInt16BE(IP_DISCOVERY_TYPE, 0); // Type: IP Discovery
    packet.writeUInt16BE(IP_DISCOVERY_PACKET_SIZE, 2); // Length
    packet.writeUInt32BE(this.#ssrc, 4); // SSRC
    this.#socket.send(packet, port, address, (err) => {
      if (err) {
        this.emit('error', err);
      }
    });
  }

  /**
   * Send audio packet with batching
   */
  send(packet: Buffer): void {
    if (!this.#remote) return;

    // Buffer packet for batch sending
    this.#sendBuffer.push(packet);

    // Flush after 10 packets or on next tick
    if (this.#sendBuffer.length >= 10) {
      this.#flushSendBuffer();
    } else if (!this.#isFlushing) {
      this.#isFlushing = true;
      setImmediate(() => this.#flushSendBuffer());
    }
  }

  /**
   * Flush buffered packets
   */
  #flushSendBuffer(): void {
    if (this.#sendBuffer.length === 0) {
      this.#isFlushing = false;
      return;
    }

    const batch = this.#sendBuffer.splice(0, 20); // Send up to 20 packets
    for (const packet of batch) {
      if (this.#remote) {
        this.#socket.send(packet, this.#remote.port, this.#remote.ip, (err) => {
          if (err) {
            this.emit('error', err);
          }
        });
      }
    }

    this.#isFlushing = false;

    // Schedule next batch if buffer has more packets
    if (this.#sendBuffer.length > 0) {
      this.#isFlushing = true;
      setImmediate(() => this.#flushSendBuffer());
    }
  }

  /**
   * Close socket and cleanup
   */
  close(): void {
    // Flush remaining packets before closing
    if (this.#sendBuffer.length > 0) {
      this.#flushSendBuffer();
    }
    this.#socket.close();
    this.removeAllListeners();
    this.#sendBuffer.length = 0;
  }

  /**
   * Get local address binding
   */
  get localAddress(): { ip: string; port: number } | undefined {
    const address = this.#socket.address();
    if (typeof address === 'object') {
      return { ip: address.address, port: address.port };
    }
    return undefined;
  }

  /**
   * Get remote address
   */
  get remoteAddress(): { ip: string; port: number } | undefined {
    return this.#remote;
  }

  /**
   * Check if ready (IP discovered)
   */
  get isReady(): boolean {
    return this.#ready;
  }

  /**
   * Get pending packets in buffer
   */
  get pendingPackets(): number {
    return this.#sendBuffer.length;
  }
}
