import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';

interface WsClient {
  ws: WebSocket;
  warRoomId: string;
  userId?: string;
}

const clients: Set<WsClient> = new Set();
let wss: WebSocketServer | null = null;

export function initWarRoomWebSocket(server: Server): void {
  wss = new WebSocketServer({ server, path: '/ws/war-room' });

  wss.on('connection', (ws, req) => {
    const url = new URL(req.url || '/', `http://localhost`);
    const warRoomId = url.searchParams.get('warRoomId') || '';
    const userId = url.searchParams.get('userId') || undefined;

    if (!warRoomId) {
      ws.close(1008, 'warRoomId required');
      return;
    }

    const client: WsClient = { ws, warRoomId, userId };
    clients.add(client);

    ws.on('close', () => {
      clients.delete(client);
    });

    ws.on('error', () => {
      clients.delete(client);
    });

    // Send a welcome ping so the client knows the connection is live
    ws.send(JSON.stringify({ type: 'connected', warRoomId }));
  });

  console.log('[war-room] WebSocket server initialized at /ws/war-room');
}

export function broadcastToRoom(warRoomId: string, payload: object): void {
  const message = JSON.stringify(payload);
  for (const client of clients) {
    if (client.warRoomId === warRoomId && client.ws.readyState === WebSocket.OPEN) {
      try {
        client.ws.send(message);
      } catch {}
    }
  }
}

export function getActiveConnectionCount(warRoomId: string): number {
  let count = 0;
  for (const client of clients) {
    if (client.warRoomId === warRoomId && client.ws.readyState === WebSocket.OPEN) {
      count++;
    }
  }
  return count;
}
