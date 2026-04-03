---
name: WebRTC & Real-time Video/Audio
trigger: WebRTC, video call, audio call, peer-to-peer, P2P, STUN, TURN, ICE, signaling, SFU, MCU, screen sharing, media stream, RTCPeerConnection, getUserMedia, video chat, voice chat, live streaming, Mediasoup, Janus, Livekit, video conferencing, codec, SDP, ICE candidate
description: Design and implement WebRTC-based real-time video, audio, and data communication. Covers signaling, ICE/STUN/TURN, P2P vs SFU architecture, codec selection, connection reliability, and production media servers.
---

# ROLE
You are a real-time media engineer. Your job is to build video/audio communication that connects reliably through firewalls and NAT, degrades gracefully on poor networks, and scales beyond 1-on-1 calls. WebRTC is powerful but has sharp edges around NAT traversal, signaling, and multi-party scalability.

# CORE PRINCIPLES
```
SIGNALING IS YOUR JOB:   WebRTC doesn't define signaling. You must build it (WebSocket is standard).
NAT TRAVERSAL IS HARD:   STUN works 80% of the time. You MUST have TURN as fallback.
P2P LIMITS AT 4+:        Beyond 4 participants in a mesh, use an SFU — P2P mesh doesn't scale.
FAIL GRACEFULLY:         Connection fails → show clear error, offer retry. Never hang silently.
BANDWIDTH IS NOT FREE:   Set bitrate limits. Users on mobile will thank you.
ALWAYS REQUEST PERMISSIONS LATE: Ask for camera/mic only when the user initiates a call.
```

# ARCHITECTURE PATTERNS

## P2P Mesh (≤ 4 participants)
```
Every peer connects directly to every other peer.
N peers = N*(N-1)/2 connections total, N-1 upstream streams per peer

  Alice ←──────→ Bob
    ↑ ↘        ↙ ↑
    │   Charlie   │
    └─────────────┘

PROS:  No media server needed, lowest latency, no server media processing cost
CONS:  Upload bandwidth per client = (N-1) × stream bitrate
       4 participants HD = 3 × 2Mbps = 6Mbps upload per client — high
USE FOR: 1-on-1, 1-on-2, small group calls (≤ 3-4)
```

## SFU — Selective Forwarding Unit (recommended for 4+ participants)
```
Every client sends one stream to the SFU.
SFU forwards each client's stream to all other clients (no transcoding — just routing).

  Alice ──► SFU ──► Bob
  Bob   ──► SFU ──► Alice
  Carol ──► SFU ──► Alice, Bob

PROS:  Each client uploads only ONE stream regardless of participant count
       SFU can select which streams to forward (bandwidth adaptation, active speaker)
       Scalable to 100+ participants with proper architecture
CONS:  Requires media server (Mediasoup, Livekit, Janus, Ion)
       Media goes through your infrastructure (latency, bandwidth cost)
USE FOR: Group video calls, webinars, livestreams

SFU OPTIONS:
  Mediasoup    — Node.js, C++, most performant, most complex to operate
  LiveKit      — Go, easiest to self-host, excellent SDKs, managed cloud option
  Janus        — C, widely deployed, plugin-based, well-documented
  Agora/Twilio — Fully managed, expensive, lowest ops burden
  Daily.co     — Fully managed WebRTC, simple API, good for fast integration
```

## MCU — Multipoint Control Unit (avoid unless necessary)
```
MCU receives all streams, decodes, mixes them into one composite stream, re-encodes.

PROS:  Each client receives ONE stream (lowest bandwidth for clients)
CONS:  Massive CPU usage for transcoding, highest latency, server cost is enormous
USE FOR: Very rarely — only when clients have very limited bandwidth and can't handle SFU
```

# SIGNALING SERVER

## WebSocket Signaling (Reference Implementation)
```javascript
// server/signaling.js
import { WebSocketServer } from 'ws';

const rooms = new Map(); // roomId → Set of { ws, peerId }

const wss = new WebSocketServer({ port: 8080 });

wss.on('connection', (ws) => {
  let currentRoom = null;
  let peerId = null;

  ws.on('message', async (data) => {
    const message = JSON.parse(data);
    
    switch (message.type) {
      case 'join':
        peerId = message.peerId;
        currentRoom = message.roomId;
        
        if (!rooms.has(currentRoom)) {
          rooms.set(currentRoom, new Set());
        }
        
        // Notify existing peers about new joiner
        const existing = [...rooms.get(currentRoom)];
        existing.forEach(({ ws: peerWs, peerId: existingPeerId }) => {
          send(peerWs, { type: 'peer-joined', peerId });
          // Tell new joiner about existing peers (so they initiate)
          send(ws, { type: 'existing-peer', peerId: existingPeerId });
        });
        
        rooms.get(currentRoom).add({ ws, peerId });
        send(ws, { type: 'joined', roomId: currentRoom, peerCount: existing.length });
        break;

      case 'offer':
      case 'answer':
      case 'ice-candidate':
        // Relay to target peer
        relay(currentRoom, message.targetPeerId, {
          ...message,
          fromPeerId: peerId
        });
        break;
    }
  });

  ws.on('close', () => {
    if (currentRoom && rooms.has(currentRoom)) {
      rooms.get(currentRoom).forEach(p => {
        if (p.peerId !== peerId) {
          send(p.ws, { type: 'peer-left', peerId });
        }
      });
      rooms.get(currentRoom).delete([...rooms.get(currentRoom)].find(p => p.peerId === peerId));
      if (rooms.get(currentRoom).size === 0) rooms.delete(currentRoom);
    }
  });
});

function relay(roomId, targetPeerId, message) {
  const room = rooms.get(roomId);
  if (!room) return;
  const target = [...room].find(p => p.peerId === targetPeerId);
  if (target) send(target.ws, message);
}

function send(ws, message) {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(message));
  }
}
```

# PEER CONNECTION (CLIENT)

## RTCPeerConnection Lifecycle
```javascript
class PeerConnection {
  constructor(peerId, isInitiator, signalingChannel) {
    this.peerId = peerId;
    this.isInitiator = isInitiator;
    this.signaling = signalingChannel;
    
    this.pc = new RTCPeerConnection({
      iceServers: [
        // STUN — discover public IP (free, Google's servers)
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        
        // TURN — relay when direct connection fails (your server)
        {
          urls: 'turn:turn.yourapp.com:3478',
          username: 'your-turn-username',
          credential: 'your-turn-password'
        },
        // TURN over TLS (for networks that block UDP)
        {
          urls: 'turns:turn.yourapp.com:5349',
          username: 'your-turn-username',
          credential: 'your-turn-password'
        }
      ],
      iceCandidatePoolSize: 10,           // gather candidates before signaling
      bundlePolicy: 'max-bundle',         // use one port for audio+video
      rtcpMuxPolicy: 'require'            // mux RTCP with RTP — reduces port usage
    });
    
    this.setupEventHandlers();
  }
  
  setupEventHandlers() {
    // Send ICE candidates as they're discovered
    this.pc.onicecandidate = ({ candidate }) => {
      if (candidate) {
        this.signaling.send({ type: 'ice-candidate', targetPeerId: this.peerId, candidate });
      }
    };
    
    this.pc.oniceconnectionstatechange = () => {
      console.log('ICE state:', this.pc.iceConnectionState);
      
      if (this.pc.iceConnectionState === 'failed') {
        this.pc.restartIce();  // trigger ICE restart — renegotiates candidates
      }
      
      if (this.pc.iceConnectionState === 'disconnected') {
        // Often temporary (brief network hiccup) — wait before acting
        setTimeout(() => {
          if (this.pc.iceConnectionState === 'disconnected') {
            this.onConnectionFailed?.();
          }
        }, 5000);
      }
    };
    
    // Receive remote track
    this.pc.ontrack = (event) => {
      this.onRemoteTrack?.(event.streams[0], event.track.kind);
    };
  }
  
  async addLocalStream(stream) {
    stream.getTracks().forEach(track => {
      this.pc.addTrack(track, stream);
    });
  }
  
  async createAndSendOffer() {
    const offer = await this.pc.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: true
    });
    await this.pc.setLocalDescription(offer);
    this.signaling.send({ type: 'offer', targetPeerId: this.peerId, sdp: offer });
  }
  
  async handleOffer(sdp) {
    await this.pc.setRemoteDescription(new RTCSessionDescription(sdp));
    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);
    this.signaling.send({ type: 'answer', targetPeerId: this.peerId, sdp: answer });
  }
  
  async handleAnswer(sdp) {
    await this.pc.setRemoteDescription(new RTCSessionDescription(sdp));
  }
  
  async addIceCandidate(candidate) {
    if (this.pc.remoteDescription) {
      await this.pc.addIceCandidate(new RTCIceCandidate(candidate));
    } else {
      // Queue candidates if remote description not set yet
      this.pendingCandidates = this.pendingCandidates || [];
      this.pendingCandidates.push(candidate);
    }
  }
  
  close() {
    this.pc.close();
  }
}
```

# MEDIA CAPTURE & CONSTRAINTS

## getUserMedia Best Practices
```javascript
async function requestMedia(options = {}) {
  const constraints = {
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      sampleRate: 48000
    },
    video: options.videoEnabled !== false ? {
      width: { ideal: 1280, max: 1920 },
      height: { ideal: 720, max: 1080 },
      frameRate: { ideal: 30, max: 60 },
      facingMode: 'user'          // 'user' = front cam, 'environment' = rear
    } : false
  };
  
  try {
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    return { stream, error: null };
  } catch (err) {
    const errors = {
      'NotFoundError':     'No camera/microphone found',
      'NotAllowedError':   'Camera/microphone permission denied',
      'NotReadableError':  'Camera/microphone is in use by another application',
      'OverconstrainedError': 'Camera does not support requested resolution'
    };
    return { stream: null, error: errors[err.name] || `Media error: ${err.message}` };
  }
}

// Screen sharing
async function requestScreenShare() {
  const stream = await navigator.mediaDevices.getDisplayMedia({
    video: { displaySurface: 'monitor', frameRate: { max: 30 } },
    audio: { echoCancellation: false, noiseSuppression: false } // system audio
  });
  return stream;
}
```

# COTURN (TURN SERVER SETUP)

## Essential TURN Configuration
```ini
# /etc/coturn/turnserver.conf
listening-port=3478
tls-listening-port=5349

# Your server's public IP
external-ip=YOUR.PUBLIC.IP

# TURN credentials — use time-limited HMAC credentials in production
lt-cred-mech
use-auth-secret
static-auth-secret=your-long-random-secret   # generate: openssl rand -hex 32

# TLS certificates (from Let's Encrypt)
cert=/etc/letsencrypt/live/turn.yourapp.com/fullchain.pem
pkey=/etc/letsencrypt/live/turn.yourapp.com/privkey.pem

# Restrict relay to your IP range (security)
denied-peer-ip=10.0.0.0-10.255.255.255
denied-peer-ip=172.16.0.0-172.31.255.255
denied-peer-ip=192.168.0.0-192.168.255.255

# Logging
log-file=/var/log/coturn/turn.log
verbose
```

```javascript
// Generate time-limited TURN credentials (recommended — not static passwords)
function generateTurnCredentials(userId) {
  const ttl = 24 * 3600; // 24 hours
  const expiry = Math.floor(Date.now() / 1000) + ttl;
  const username = `${expiry}:${userId}`;
  const hmac = crypto.createHmac('sha1', process.env.TURN_SECRET);
  hmac.update(username);
  const credential = hmac.digest('base64');
  
  return { username, credential, ttl };
}
```

# QUALITY & BANDWIDTH MANAGEMENT

## Adaptive Bitrate
```javascript
// Limit bandwidth via SDP modification or RTCRtpSender encoding parameters
async function setVideoBandwidth(peerConnection, maxKbps) {
  const senders = peerConnection.getSenders();
  const videoSender = senders.find(s => s.track?.kind === 'video');
  
  if (videoSender) {
    const params = videoSender.getParameters();
    if (!params.encodings) params.encodings = [{}];
    params.encodings[0].maxBitrate = maxKbps * 1000;
    await videoSender.setParameters(params);
  }
}

// Network quality tiers
const QUALITY_TIERS = {
  high:   { video: 2500, audio: 128 },  // WiFi / good 4G
  medium: { video: 800,  audio: 64  },  // moderate 4G
  low:    { video: 300,  audio: 32  },  // poor connection
  audio:  { video: 0,    audio: 32  }   // disable video
};

// Monitor connection quality via WebRTC stats
async function monitorQuality(pc, onQualityChange) {
  const stats = await pc.getStats();
  stats.forEach(report => {
    if (report.type === 'inbound-rtp' && report.kind === 'video') {
      const packetLoss = report.packetsLost / (report.packetsReceived + report.packetsLost);
      const jitter = report.jitter;
      
      if (packetLoss > 0.1 || jitter > 0.05) {
        onQualityChange('degraded', { packetLoss, jitter });
      }
    }
  });
}
```

# PRODUCTION CHECKLIST
```
[ ] STUN servers configured (at least 2 for redundancy)
[ ] TURN server deployed with TLS (turns://) — tested with symmetric NAT
[ ] Time-limited TURN credentials (HMAC) — not static passwords
[ ] Signaling server uses WebSocket with reconnection logic
[ ] ICE restart implemented on connection failure
[ ] Disconnected state handled with timeout before showing error UI
[ ] P2P for ≤ 3 participants, SFU for 4+
[ ] getUserMedia errors handled gracefully with user-facing messages
[ ] Camera/mic permission requested only when call starts — not on page load
[ ] Video bitrate limited per network quality tier
[ ] Quality monitoring via WebRTC stats API (packet loss, jitter)
[ ] Screen sharing uses getDisplayMedia with track.onended for stop button
[ ] Codec preference set: VP9 (WebM) or H.264 (Safari compatibility)
[ ] Audio: echoCancellation, noiseSuppression, autoGainControl all enabled
[ ] TURN server load monitored (allocation count, bandwidth, CPU)
[ ] End-to-end encryption via insertable streams for sensitive calls (DTLS is transport-only)
[ ] Room cleanup when all participants leave (server-side)
[ ] Mobile: handle audio session interruption (phone call, other app takes audio focus)
```
