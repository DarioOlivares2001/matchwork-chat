import { Component, OnDestroy, ViewChild, ElementRef, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgIf, NgForOf, NgClass, DatePipe } from '@angular/common';
import { Subscription } from 'rxjs';
import { WebsocketChatService } from '../../services/websocket-chat.service';
import { ChatMessage } from '../../models/chat-message';

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [
    NgIf,
    NgForOf,
    NgClass,
    FormsModule,
    DatePipe
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

    // 1) Limpiar estado
    this.subs.forEach(s => s.unsubscribe());
    this.subs = [];
    this.messages = [];
    this.connectionStatus = 'connecting';
    this.cdr.detectChanges();

    // 2) Conectar y escuchar estado
    this.chatService.connect(this.currentUserId);
    this.subs.push(
      this.chatService.connectionStatus$.subscribe(open => {
        this.connectionStatus = open ? 'connected' : 'disconnected';
        this.cdr.detectChanges();
        if (open) this.loadHistory();
      })
    );

    // 3) **Suscribirse a nuevos mensajes**:
    this.subs.push(
      this.chatService.newMessage$.subscribe(msg => {
        const relevant =
          (msg.senderId === this.currentUserId   && msg.receiverId === this.otherUserId) ||
          (msg.senderId === this.otherUserId     && msg.receiverId === this.currentUserId);
        if (!relevant) return;

        // Evitar duplicados
        const exists = this.messages.some(m =>
          m.senderId === msg.senderId &&
          m.receiverId === msg.receiverId &&
          m.content === msg.content &&
          new Date(m.timestamp).getTime() === new Date(msg.timestamp).getTime()
        );
        if (!exists) {
          this.messages = [...this.messages, msg].sort((a, b) =>
            new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
          );
          this.cdr.detectChanges();
          this.scrollToBottom();
        }
      })
    );
  }

  private loadHistory() {
    this.chatService.getMessageHistory(this.currentUserId, this.otherUserId)
      .subscribe(history => {
        this.messages = [...history];
        this.cdr.detectChanges();
        this.scrollToBottom();
      });
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
    // Feedback inmediato
    this.messages = [...this.messages, msg];
    this.newMessage = '';
    this.cdr.detectChanges();
    this.scrollToBottom();

    // Envío real
    this.chatService.sendPrivateMessage(msg);
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
