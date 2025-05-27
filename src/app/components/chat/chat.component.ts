import {
  Component,
  OnDestroy,
  ViewChild,
  ElementRef,
  ChangeDetectorRef
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgIf, NgForOf, NgClass, DatePipe } from '@angular/common';
import { Subscription } from 'rxjs';
import { WebsocketChatService } from '../../services/websocket-chat.service';
import { ChatMessage } from '../../models/chat-message';
import { JitsiComponent } from '../jitsi/jitsi.component';

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [
    NgIf,
    NgForOf,
    NgClass,
    FormsModule,
    DatePipe,
    JitsiComponent
  ],
  templateUrl: './chat.component.html',
  styleUrls: ['./chat.component.css']
})
export class ChatComponent implements OnDestroy {
  @ViewChild('messagesContainer') private messagesContainer!: ElementRef;

  currentUserId = 0;
  otherUserId   = 0;
  messages: ChatMessage[] = [];
  newMessage = '';
  connectionStatus: 'connecting'|'connected'|'disconnected'|'error' = 'disconnected';
  showVideoInvitation = false;
  videoInvitationFrom = 0;
  isInVideoCall = false;

  showVideo = false;
  get videoRoomName() {
    return `MatchWorkInterview_${Math.min(this.currentUserId, this.otherUserId)}_${Math.max(this.currentUserId, this.otherUserId)}`;
  }

  private subs: Subscription[] = [];

  constructor(
    private chatService: WebsocketChatService,
    private cdr: ChangeDetectorRef
  ) {}

  startConversation() {
    if (!this.currentUserId || !this.otherUserId) {
      alert('Debes ingresar ambos IDs.');
      return;
    }

    // reset
    this.subs.forEach(s => s.unsubscribe());
    this.subs = [];
    this.messages = [];
    this.showVideo = false;
    this.connectionStatus = 'connecting';
    this.cdr.detectChanges();

    // conecta WS
    this.chatService.connect(this.currentUserId);
    this.subs.push(
      this.chatService.connectionStatus$
        .subscribe(open => {
          this.connectionStatus = open ? 'connected' : 'disconnected';
          this.cdr.detectChanges();
          if (open) this.loadHistory();
        })
    );

    // escucha mensajes entrantes
    this.subs.push(
      this.chatService.newMessage$
        .subscribe(msg => {
          console.log('Mensaje recibido:', msg);

          // Manejar señal de videollamada
          if (msg.type === 'VIDEO_CALL' && msg.receiverId === this.currentUserId) {
            console.log('Señal de videollamada recibida de:', msg.senderId);
            this.videoInvitationFrom = msg.senderId;
            this.showVideoInvitation = true;
            this.cdr.detectChanges();
            return;
          }

          // mensajes normales de chat
          const relevant =
            (msg.senderId === this.currentUserId && msg.receiverId === this.otherUserId) ||
            (msg.senderId === this.otherUserId && msg.receiverId === this.currentUserId);
          
          if (!relevant) return;

          // evita duplicados
          const exists = this.messages.some(m =>
            m.senderId === msg.senderId &&
            m.receiverId === msg.receiverId &&
            m.content === msg.content &&
            new Date(m.timestamp).getTime() === new Date(msg.timestamp).getTime()
          );
          
          if (!exists) {
            this.messages = [...this.messages, msg]
              .sort((a, b) =>
                new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
              );
            this.cdr.detectChanges();
            this.scrollToBottom();
          }
        })
    );
  }

  private showVideoCallNotification(senderId: number) {
    // Opcional: mostrar una notificación o confirmación antes de abrir Jitsi
    const shouldAccept = confirm(`Usuario ${senderId} te está invitando a una entrevista. ¿Aceptar?`);
    if (!shouldAccept) {
      this.showVideo = false;
    }
  }

  private loadHistory() {
    this.chatService.getMessageHistory(this.currentUserId, this.otherUserId)
      .subscribe(history => {
        // Filtrar mensajes VIDEO_CALL del historial
        this.messages = [...history.filter(msg => msg.type !== 'VIDEO_CALL')];
        this.cdr.detectChanges();
        this.scrollToBottom();
      });
  }


  // Métodos para manejar la invitación
  acceptVideoCall() {
    this.showVideoInvitation = false;
    this.showVideo = true;
    this.isInVideoCall = true;
    this.cdr.detectChanges();
    
    // Opcional: enviar confirmación al remitente
    const confirmationMsg: ChatMessage = {
      senderId: this.currentUserId,
      receiverId: this.videoInvitationFrom,
      content: 'El usuario ha aceptado la videollamada',
      type: 'CHAT',
      timestamp: new Date().toISOString()
    };
    this.chatService.sendPrivateMessage(confirmationMsg);
  }

  declineVideoCall() {
    this.showVideoInvitation = false;
    this.cdr.detectChanges();
    
    // Opcional: enviar rechazo al remitente
    const rejectionMsg: ChatMessage = {
      senderId: this.currentUserId,
      receiverId: this.videoInvitationFrom,
      content: 'El usuario ha rechazado la videollamada',
      type: 'CHAT',
      timestamp: new Date().toISOString()
    };
    this.chatService.sendPrivateMessage(rejectionMsg);
  }

  sendMessage() {
    if (!this.newMessage.trim() || this.connectionStatus !== 'connected') return;
    
    const msg: ChatMessage = {
      senderId: this.currentUserId,
      receiverId: this.otherUserId,
      content: this.newMessage.trim(),
      type: 'CHAT',
      timestamp: new Date().toISOString()
    };
    
    // UI inmediata
    this.messages = [...this.messages, msg];
    this.newMessage = '';
    this.cdr.detectChanges();
    this.scrollToBottom();

    this.chatService.sendPrivateMessage(msg);
  }

  onKeyDown(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  startVideoCall() {
    if (this.connectionStatus !== 'connected') return;
    
    this.showVideo = true;
    this.isInVideoCall = true;
    this.cdr.detectChanges();
    
    const msg: ChatMessage = {
      senderId: this.currentUserId,
      receiverId: this.otherUserId,
      content: JSON.stringify({
        roomName: this.videoRoomName,
        callType: 'interview',
        timestamp: new Date().getTime()
      }),
      type: 'VIDEO_CALL',
      timestamp: new Date().toISOString()
    };
    
    this.chatService.sendPrivateMessage(msg);
  }

  closeVideoCall() {
    this.showVideo = false;
    this.cdr.detectChanges();
  }

  private scrollToBottom() {
    setTimeout(() => {
      const el = this.messagesContainer.nativeElement;
      el.scrollTop = el.scrollHeight;
    }, 50);
  }

  trackMessage(_i: number, m: ChatMessage) {
    return m.id || `${m.senderId}-${m.receiverId}-${m.timestamp}`;
  }

  ngOnDestroy() {
    this.subs.forEach(s => s.unsubscribe());
    if (this.currentUserId) {
      this.chatService.disconnect(this.currentUserId);
    }
  }
}