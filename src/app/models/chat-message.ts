export interface ChatMessage {
  id?: string;
  senderId: number;
  receiverId: number;
  content: string;
  type: 'CHAT' | 'JOIN' | 'LEAVE' | 'VIDEO_CALL' ;
  timestamp: string; // Cambiado a string para manejo consistente
}