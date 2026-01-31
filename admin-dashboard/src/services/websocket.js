class WebSocketService {
  constructor() {
    this.ws = null;
    this.reconnectInterval = 5000;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.listeners = new Map();
    this.isIntentionallyClosed = false;
  }

  connect(token) {
    // Determine WebSocket protocol based on current page protocol
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const WS_URL = import.meta.env.VITE_WS_URL || `${protocol}//${window.location.host}`;
    
    // Clean up the URL if it already has protocol
    const cleanUrl = WS_URL.replace(/^(ws|wss):\/\//, '');
    const wsUrl = `${protocol}//${cleanUrl}/ws?token=${token}`;

    console.log('Connecting to WebSocket:', wsUrl);
    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      this.isIntentionallyClosed = false;

      // Subscribe to all channels
      this.subscribe('devices');
      this.subscribe('gateways');
      this.subscribe('sensor_data');
      this.subscribe('ota');
      this.subscribe('logs');
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        // Notify listeners
        if (data.channel && this.listeners.has(data.channel)) {
          const callbacks = this.listeners.get(data.channel);
          callbacks.forEach((callback) => callback(data.data));
        }
      } catch (error) {
        console.error('WebSocket message parse error:', error);
      }
    };

    this.ws.onerror = (error) => {
      console.error(' WebSocket error:', error);
    };

    this.ws.onclose = () => {
      console.log('WebSocket closed');
      if (!this.isIntentionallyClosed && this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++;
        console.log(`WebSocket reconnecting... attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
        setTimeout(() => this.connect(token), this.reconnectInterval);
      } else if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        console.error('WebSocket max reconnect attempts reached');
      }
    };
  }

  subscribe(channel) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(
        JSON.stringify({
          action: 'subscribe',
          channel,
        })
      );
    }
  }

  unsubscribe(channel) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(
        JSON.stringify({
          action: 'unsubscribe',
          channel,
        })
      );
    }
  }

  on(channel, callback) {
    if (!this.listeners.has(channel)) {
      this.listeners.set(channel, []);
    }
    this.listeners.get(channel).push(callback);
  }

  off(channel, callback) {
    if (this.listeners.has(channel)) {
      const callbacks = this.listeners.get(channel);
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  disconnect() {
    this.isIntentionallyClosed = true;
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.listeners.clear();
  }

  isConnected() {
    return this.ws && this.ws.readyState === WebSocket.OPEN;
  }
}

// Singleton instance
const wsService = new WebSocketService();
export default wsService;
