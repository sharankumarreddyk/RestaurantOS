import { useEffect, useRef, useCallback, useState } from 'react';
import { getToken } from '../api/client';

const MAX_RETRIES = 10;

export default function useWebSocket(onMessage) {
  const ws = useRef(null);
  const reconnectTimeout = useRef(null);
  const reconnectDelay = useRef(1000);
  const retryCount = useRef(0);
  const [connected, setConnected] = useState(false);

  const connect = useCallback(() => {
    const token = getToken();
    if (!token) return;
    if (retryCount.current >= MAX_RETRIES) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${protocol}//${window.location.host}/ws`;

    try {
      ws.current = new WebSocket(url);
    } catch {
      return;
    }

    ws.current.onopen = () => {
      reconnectDelay.current = 1000;
      retryCount.current = 0;
      // First-message auth instead of query param
      ws.current.send(JSON.stringify({ type: 'auth', token }));
    };

    ws.current.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'connected') {
          setConnected(true);
        }
        onMessage?.(data);
      } catch {
        // ignore malformed messages
      }
    };

    ws.current.onclose = (event) => {
      setConnected(false);
      // Don't reconnect if auth failed or max retries hit
      if (event.code === 4001 || event.code === 4029) return;
      if (retryCount.current >= MAX_RETRIES) return;

      retryCount.current++;
      reconnectTimeout.current = setTimeout(() => {
        reconnectDelay.current = Math.min(reconnectDelay.current * 2, 30000);
        connect();
      }, reconnectDelay.current);
    };

    ws.current.onerror = () => {
      ws.current?.close();
    };
  }, [onMessage]);

  useEffect(() => {
    connect();
    return () => {
      clearTimeout(reconnectTimeout.current);
      retryCount.current = MAX_RETRIES; // prevent reconnect on unmount
      ws.current?.close();
    };
  }, [connect]);

  return { ws, connected };
}
