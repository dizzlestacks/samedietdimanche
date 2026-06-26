import { useEffect, useRef, useState, useCallback } from "react";

interface WsMessage {
  type: string;
  [key: string]: any;
}

type MessageHandler = (msg: WsMessage) => void;

let globalWs: WebSocket | null = null;
let globalHandlers = new Set<MessageHandler>();
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_DELAY = 30000;

function getWsUrl() {
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${window.location.host}/ws`;
}

function connectGlobal() {
  if (globalWs?.readyState === WebSocket.OPEN || globalWs?.readyState === WebSocket.CONNECTING) {
    return;
  }

  try {
    globalWs = new WebSocket(getWsUrl());

    globalWs.onopen = () => {
      reconnectAttempts = 0;
    };

    globalWs.onmessage = (event) => {
      try {
        const msg: WsMessage = JSON.parse(event.data);
        globalHandlers.forEach((handler) => handler(msg));
      } catch {}
    };

    globalWs.onclose = (event) => {
      globalWs = null;
      if (event.code !== 1000 && event.code !== 1001) {
        scheduleReconnect();
      }
    };

    globalWs.onerror = () => {
      globalWs?.close();
    };
  } catch {
    scheduleReconnect();
  }
}

function scheduleReconnect() {
  if (reconnectTimer) return;
  const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), MAX_RECONNECT_DELAY);
  reconnectAttempts++;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connectGlobal();
  }, delay);
}

function disconnectGlobal() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (globalWs) {
    globalWs.close(1000);
    globalWs = null;
  }
  reconnectAttempts = 0;
}

export function useWebSocket(onMessage?: MessageHandler, enabled = true) {
  const [connected, setConnected] = useState(false);
  const handlerRef = useRef<MessageHandler | undefined>(onMessage);
  handlerRef.current = onMessage;

  useEffect(() => {
    if (!enabled) {
      setConnected(false);
      return;
    }

    const handler: MessageHandler = (msg) => {
      if (msg.type === "connected") {
        setConnected(true);
      }
      handlerRef.current?.(msg);
    };

    globalHandlers.add(handler);
    connectGlobal();

    const checkConnection = setInterval(() => {
      setConnected(globalWs?.readyState === WebSocket.OPEN);
    }, 3000);

    return () => {
      globalHandlers.delete(handler);
      clearInterval(checkConnection);
      if (globalHandlers.size === 0) {
        disconnectGlobal();
      }
    };
  }, [enabled]);

  const send = useCallback((msg: WsMessage) => {
    if (globalWs?.readyState === WebSocket.OPEN) {
      globalWs.send(JSON.stringify(msg));
    }
  }, []);

  return { connected, send };
}
