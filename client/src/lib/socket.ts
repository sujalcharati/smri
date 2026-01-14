import { io, Socket } from 'socket.io-client'

let socket: Socket | null = null

export const initSocket = (): Socket => {
  if (!socket) {
    socket = io('/', {
      autoConnect: false,
      transports: ['websocket', 'polling'],
    })
  }
  return socket
}

export const connectSocket = (workspaceId: string) => {
  const s = initSocket()

  if (!s.connected) {
    s.connect()
  }

  s.emit('join-workspace', workspaceId)
  return s
}

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect()
  }
}

export const getSocket = () => socket
