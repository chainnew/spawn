/**
 * WebRTC connection manager for peer-to-peer communication
 * with the spawn backend (future use for real-time collab)
 */

export interface RTCConfig {
  signalingUrl: string
  iceServers?: RTCIceServer[]
}

export class SpawnRTC {
  private pc: RTCPeerConnection | null = null
  private dc: RTCDataChannel | null = null
  private ws: WebSocket | null = null
  private config: RTCConfig

  onOpen?: () => void
  onClose?: () => void
  onMessage?: (data: string) => void
  onError?: (error: Error) => void

  constructor(config: RTCConfig) {
    this.config = {
      ...config,
      iceServers: config.iceServers || [
        { urls: 'stun:stun.l.google.com:19302' },
      ],
    }
  }

  async connect(): Promise<void> {
    // Connect to signaling server
    this.ws = new WebSocket(this.config.signalingUrl)
    
    this.ws.onopen = () => {
      this.initPeerConnection()
    }

    this.ws.onmessage = async (event) => {
      const msg = JSON.parse(event.data)
      await this.handleSignalingMessage(msg)
    }

    this.ws.onerror = () => {
      this.onError?.(new Error('Signaling connection failed'))
    }

    this.ws.onclose = () => {
      this.onClose?.()
    }
  }

  private initPeerConnection() {
    this.pc = new RTCPeerConnection({
      iceServers: this.config.iceServers,
    })

    // Create data channel
    this.dc = this.pc.createDataChannel('spawn', {
      ordered: true,
    })

    this.dc.onopen = () => {
      this.onOpen?.()
    }

    this.dc.onclose = () => {
      this.onClose?.()
    }

    this.dc.onmessage = (event) => {
      this.onMessage?.(event.data)
    }

    // Handle ICE candidates
    this.pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.ws?.send(JSON.stringify({
          type: 'ice-candidate',
          candidate: event.candidate,
        }))
      }
    }

    // Create and send offer
    this.pc.createOffer()
      .then((offer) => this.pc!.setLocalDescription(offer))
      .then(() => {
        this.ws?.send(JSON.stringify({
          type: 'offer',
          sdp: this.pc!.localDescription,
        }))
      })
  }

  private async handleSignalingMessage(msg: any) {
    if (!this.pc) return

    switch (msg.type) {
      case 'answer':
        await this.pc.setRemoteDescription(new RTCSessionDescription(msg.sdp))
        break

      case 'ice-candidate':
        if (msg.candidate) {
          await this.pc.addIceCandidate(new RTCIceCandidate(msg.candidate))
        }
        break
    }
  }

  send(data: string) {
    if (this.dc?.readyState === 'open') {
      this.dc.send(data)
    }
  }

  disconnect() {
    this.dc?.close()
    this.pc?.close()
    this.ws?.close()
    this.dc = null
    this.pc = null
    this.ws = null
  }
}

// Singleton instance
let instance: SpawnRTC | null = null

export function getSpawnRTC(config?: RTCConfig): SpawnRTC {
  if (!instance && config) {
    instance = new SpawnRTC(config)
  }
  return instance!
}
