import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "http";
import type { IncomingMessage } from "http";
import { log } from "./index";

interface AuthenticatedSocket extends WebSocket {
  userId?: string;
  isAlive?: boolean;
}

export interface WsMessage {
  type: string;
  [key: string]: any;
}

const clients = new Map<string, Set<AuthenticatedSocket>>();

let wss: WebSocketServer;

export function setupWebSocket(
  httpServer: Server,
  sessionParser: any
) {
  wss = new WebSocketServer({ noServer: true });

  httpServer.on("upgrade", (req: IncomingMessage, socket, head) => {
    if (req.url !== "/ws") {
      return;
    }

    sessionParser(req, {} as any, () => {
      const sessionReq = req as any;
      const user = sessionReq.session?.passport?.user;

      if (!user) {
        socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
        socket.destroy();
        return;
      }

      wss.handleUpgrade(req, socket, head, (ws) => {
        const authWs = ws as AuthenticatedSocket;
        const userId = user.claims?.sub || user.userId;
        authWs.userId = userId;
        authWs.isAlive = true;

        wss.emit("connection", authWs, req);
      });
    });
  });

  wss.on("connection", (ws: AuthenticatedSocket) => {
    const userId = ws.userId!;

    if (!clients.has(userId)) {
      clients.set(userId, new Set());
    }
    clients.get(userId)!.add(ws);

    log(`WebSocket connected: ${userId} (${clients.get(userId)!.size} tabs)`, "ws");

    broadcastOnlineStatus(userId, true);

    ws.on("pong", () => {
      ws.isAlive = true;
    });

    ws.on("message", (raw) => {
      try {
        const msg: WsMessage = JSON.parse(raw.toString());
        handleClientMessage(ws, msg);
      } catch {
      }
    });

    ws.on("close", () => {
      const userSockets = clients.get(userId);
      if (userSockets) {
        userSockets.delete(ws);
        if (userSockets.size === 0) {
          clients.delete(userId);
          broadcastOnlineStatus(userId, false);
        }
      }
      log(`WebSocket disconnected: ${userId}`, "ws");
    });

    ws.on("error", () => {
      ws.terminate();
    });

    ws.send(JSON.stringify({ type: "connected", userId }));
  });

  const heartbeat = setInterval(() => {
    wss.clients.forEach((ws) => {
      const authWs = ws as AuthenticatedSocket;
      if (!authWs.isAlive) {
        authWs.terminate();
        return;
      }
      authWs.isAlive = false;
      authWs.ping();
    });
  }, 30000);

  wss.on("close", () => {
    clearInterval(heartbeat);
  });

  log("WebSocket server initialized on /ws", "ws");
}

async function handleClientMessage(ws: AuthenticatedSocket, msg: WsMessage) {
  switch (msg.type) {
    case "typing": {
      const { receiverId, listingId } = msg;
      if (receiverId && receiverId !== ws.userId) {
        const hasConversation = await verifyConversation(ws.userId!, receiverId, listingId);
        if (hasConversation) {
          sendToUser(receiverId, {
            type: "typing",
            senderId: ws.userId,
            listingId: listingId || null,
          });
        }
      }
      break;
    }
    case "stop_typing": {
      const { receiverId, listingId } = msg;
      if (receiverId && receiverId !== ws.userId) {
        sendToUser(receiverId, {
          type: "stop_typing",
          senderId: ws.userId,
          listingId: listingId || null,
        });
      }
      break;
    }
    case "read": {
      const { senderId, listingId } = msg;
      if (senderId && senderId !== ws.userId) {
        const hasConversation = await verifyConversation(ws.userId!, senderId, listingId);
        if (hasConversation) {
          sendToUser(senderId, {
            type: "read",
            readBy: ws.userId,
            listingId: listingId || null,
          });
        }
      }
      break;
    }
    case "ping":
      ws.send(JSON.stringify({ type: "pong" }));
      break;
  }
}

async function verifyConversation(userId: string, otherId: string, listingId?: number | null): Promise<boolean> {
  try {
    const { storage } = await import("./storage");
    const thread = await storage.getThread(userId, otherId, listingId || null);
    return thread.length > 0;
  } catch {
    return false;
  }
}

async function broadcastOnlineStatus(userId: string, online: boolean) {
  try {
    const { storage } = await import("./storage");
    const convos = await storage.getConversations(userId);
    const partnerIds = new Set(convos.map((c: any) => c.otherId));

    const msg = JSON.stringify({ type: "presence", userId, online });
    wss.clients.forEach((ws) => {
      const authWs = ws as AuthenticatedSocket;
      if (
        authWs.userId !== userId &&
        authWs.userId &&
        partnerIds.has(authWs.userId) &&
        authWs.readyState === WebSocket.OPEN
      ) {
        authWs.send(msg);
      }
    });
  } catch {}
}

export function sendToUser(userId: string, data: WsMessage) {
  const userSockets = clients.get(userId);
  if (!userSockets) return;

  const payload = JSON.stringify(data);
  userSockets.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(payload);
    }
  });
}

export function isUserOnline(userId: string): boolean {
  const sockets = clients.get(userId);
  return !!sockets && sockets.size > 0;
}

export function getOnlineUsers(): string[] {
  return Array.from(clients.keys());
}
