# WebSocket Configuration for Cloud Deployment

For your Google Cloud VM deployment, create or update the `.env` file in the `admin-dashboard` directory:

## Local Development (.env):
```bash
VITE_API_URL=http://localhost:3000/api
VITE_WS_URL=ws://localhost:3000
```

## Cloud Production (.env or .env.production):
```bash
# Replace YOUR_VM_IP with your actual Google Cloud VM IP or domain
VITE_API_URL=http://YOUR_VM_IP:3000/api
VITE_WS_URL=ws://YOUR_VM_IP:3000

# If using HTTPS/WSS (recommended for production):
# VITE_API_URL=https://YOUR_DOMAIN/api
# VITE_WS_URL=wss://YOUR_DOMAIN
```

## Auto-Detection (Recommended)
If you leave `VITE_WS_URL` unset, the app will automatically:
- Use `ws://` for HTTP connections
- Use `wss://` for HTTPS connections
- Connect to the same host as the web page

This is now the default behavior, so you can remove `VITE_WS_URL` from your `.env` file entirely.

## Testing
After deploying, open browser console (F12) and check for:
```
Connecting to WebSocket: ws://YOUR_IP:3000/ws?token=...
```

If you see connection errors, verify:
1. Backend is running on port 3000
2. WebSocket service is initialized
3. No firewall blocking WebSocket connections
4. Token is valid and not expired
