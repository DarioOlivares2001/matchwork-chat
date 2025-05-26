import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { RxStomp } from '@stomp/rx-stomp';
import { RxStompState } from '@stomp/rx-stomp';
import { BehaviorSubject, Observable, Subscription, Subject } from 'rxjs';
import { map, distinctUntilChanged } from 'rxjs/operators';
import { ChatMessage } from '../models/chat-message';

@Injectable({ providedIn: 'root' })
export class WebsocketChatService {
  private readonly baseUrl = 'http://localhost:8082/api';
  private readonly historyUrl = `${this.baseUrl}/messages`;
  private activeSubscriptions = new Map<number, Subscription>();
  
  // ✅ CAMBIO CLAVE: Subject para nuevos mensajes individuales
  private newMessageSubject = new Subject<ChatMessage>();
  public newMessage$ = this.newMessageSubject.asObservable();
  
  public connectionStatus$: Observable<boolean>;

  constructor(
    private http: HttpClient,
    private rxStomp: RxStomp
  ) {
    this.connectionStatus$ = this.rxStomp.connectionState$.pipe(
      map(state => state === RxStompState.OPEN),
      distinctUntilChanged()
    );
  }

  connect(userId: number): void {
    this.disconnect(userId);
    if (this.rxStomp.connectionState$.getValue() !== RxStompState.OPEN) {
      this.rxStomp.activate();
    }
    setTimeout(() => {
      const topic = `/topic/private.${userId}`;
      const sub = this.rxStomp.watch(topic).subscribe(frame => {
        const m: ChatMessage = JSON.parse(frame.body);
        this.newMessageSubject.next(m);
      });
      this.activeSubscriptions.set(userId, sub);
    }, 500);
  }

  private subscribeToUserMessages(userId: number): void {
    const destination = `/user/${userId}/queue/messages`;
    console.log(`📡 INTENTANDO suscribirse a: ${destination}`);
    console.log(`📡 Estado WebSocket: ${this.rxStomp.connectionState$.getValue()}`);
    
    // Verificar si ya existe una suscripción para este usuario
    if (this.activeSubscriptions.has(userId)) {
        console.log(`ℹ️ Ya existe una suscripción activa para el usuario ${userId}`);
        return;
    }

    try {
        const subscription = this.rxStomp.watch(destination).subscribe({
            next: (message) => {
                console.log('🔔 Mensaje WebSocket recibido:', message);
                try {
                    const chatMessage: ChatMessage = JSON.parse(message.body);
                    console.log('🔥🔥🔥 MENSAJE RECIBIDO VIA WEBSOCKET:', chatMessage);
                    
                    // Emitir el mensaje sin filtrar (el componente se encargará del filtrado)
                    this.newMessageSubject.next(chatMessage);
                    
                } catch (e) {
                    console.error('❌ Error procesando mensaje:', e);
                }
            },
            error: (error) => {
                console.error('❌❌❌ ERROR EN SUSCRIPCIÓN:', error);
                this.activeSubscriptions.delete(userId);
                // Intentar reconectar después de un error
                setTimeout(() => this.subscribeToUserMessages(userId), 5000);
            },
            complete: () => {
                console.log('🏁 Suscripción completada para usuario:', userId);
                this.activeSubscriptions.delete(userId);
            }
        });

        this.activeSubscriptions.set(userId, subscription);
        console.log(`✅✅✅ SUSCRIPCIÓN ACTIVA para usuario ${userId}`);
        
    } catch (error) {
        console.error('❌ Error creando suscripción:', error);
        // Reintentar después de un error
        setTimeout(() => this.subscribeToUserMessages(userId), 5000);
    }
}

  disconnect(userId: number): void {
    const sub = this.activeSubscriptions.get(userId);
    if (sub) { sub.unsubscribe(); this.activeSubscriptions.delete(userId); }
  }

  // En el servicio WebSocketChatService, modifica sendPrivateMessage:
  sendPrivateMessage(message: ChatMessage): void {
    this.rxStomp.publish({
      destination: '/app/chat.sendPrivateMessage',
      body: JSON.stringify(message),
      headers: { 'content-type': 'application/json' }
    });
  }

  getMessageHistory(senderId: number, receiverId: number): Observable<ChatMessage[]> {
    console.log(`📜 Cargando historial: ${senderId} <-> ${receiverId}`);
    return this.http.get<ChatMessage[]>(`${this.historyUrl}/${senderId}/${receiverId}`);
  }

  // ✅ Método para limpiar suscripciones
  clearNewMessages(): void {
    // No necesitamos limpiar el Subject, solo las suscripciones
  }
}