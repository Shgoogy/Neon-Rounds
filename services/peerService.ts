import { Peer } from "peerjs";

export type PeerDataCallback = (data: any) => void;

export class PeerService {
  private peer: any; // PeerJS type instance
  private conn: any; // DataConnection instance
  public myId: string = '';
  public isHost: boolean = false;

  constructor() {
    this.peer = null;
    this.conn = null;
  }

  // Initialize Peer
  // If id is provided, we try to use it (for reconnects, though mostly we use random)
  async init(onOpen: (id: string) => void): Promise<string> {
    return new Promise((resolve, reject) => {
      // Create a random 4-char ID for easier typing if possible, but PeerJS usually takes full strings.
      // We will let PeerJS generate a long ID, but we can alias it or just use it.
      // Actually, let's try to request a short ID if the server allows, otherwise use the random one.
      // For simplicity in this demo without a custom server, we'll let PeerJS assign the ID.
      this.peer = new Peer();

      this.peer.on('open', (id: string) => {
        this.myId = id;
        onOpen(id);
        resolve(id);
      });

      this.peer.on('error', (err: any) => {
        console.error('Peer error:', err);
        reject(err);
      });
    });
  }

  // Host a game: Wait for connection
  waitForConnection(onData: PeerDataCallback, onConnect: () => void) {
    this.isHost = true;
    this.peer.on('connection', (conn: any) => {
      this.conn = conn;
      this.setupConnection(onData, onConnect);
    });
  }

  // Join a game: Connect to host ID
  connectToPeer(hostId: string, onData: PeerDataCallback, onConnect: () => void) {
    this.isHost = false;
    this.conn = this.peer.connect(hostId);
    this.setupConnection(onData, onConnect);
  }

  private setupConnection(onData: PeerDataCallback, onConnect: () => void) {
    this.conn.on('open', () => {
      console.log('Connection established');
      onConnect();
    });

    this.conn.on('data', (data: any) => {
      onData(data);
    });
    
    this.conn.on('close', () => {
        console.log("Connection closed");
    });
    
    this.conn.on('error', (err: any) => {
        console.error("Connection error", err);
    });
  }

  send(data: any) {
    if (this.conn && this.conn.open) {
      this.conn.send(data);
    }
  }

  destroy() {
    if (this.conn) this.conn.close();
    if (this.peer) this.peer.destroy();
  }
}

export const peerService = new PeerService();