import { createSocket, type RemoteInfo } from 'node:dgram';
import { EventEmitter } from 'node:events';

export class VoiceUDP extends EventEmitter {
  #socket = createSocket('udp4');
  #ssrc: number;
  #remote?: { ip: string; port: number };
  #ready = false;

  constructor(ssrc: number) {
    super();
    this.#ssrc = ssrc;

    this.#socket.on('message', (msg, rinfo) => {
      if (!this.#ready && msg.length === 70) {
        const ip = msg.subarray(4, 68).toString('utf8').replace(/\x00/g, '');
        const port = msg.readUInt16BE(68);
        this.#ready = true;
        this.emit('ipDiscovered', { ip, port });
      } else {
        this.emit('packet', msg, rinfo);
      }
    });

    this.#socket.on('error', (err) => this.emit('error', err));
  }

  bind(): Promise<void> {
    return new Promise((resolve) => {
      this.#socket.bind(0, '0.0.0.0', () => resolve());
    });
  }

  performIPDiscovery(address: string, port: number): void {
    this.#remote = { ip: address, port };
    const packet = Buffer.alloc(70);
    packet.writeUInt16BE(1, 0);
    packet.writeUInt16BE(70, 2);
    packet.writeUInt32BE(this.#ssrc, 4);
    this.#socket.send(packet, port, address);
  }

  send(packet: Buffer): void {
    if (this.#remote) {
      this.#socket.send(packet, this.#remote.port, this.#remote.ip);
    }
  }

  close(): void {
    this.#socket.close();
    this.removeAllListeners();
  }

  get localAddress(): { ip: string; port: number } | undefined {
    const address = this.#socket.address();
    if (typeof address === 'object') {
      return { ip: address.address, port: address.port };
    }
    return undefined;
  }
}
