import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { RxStomp } from '@stomp/rx-stomp';
import { RxStompState } from '@stomp/rx-stomp';
import { BehaviorSubject, Observable, Subscription, Subject } from 'rxjs';
import { map, distinctUntilChanged } from 'rxjs/operators';
import { ChatMessage } from '../models/chat-message';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class WebsocketChatService {
  private readonly baseUrl    = environment.apiUrl;
  private readonly historyUrl = `${this.baseUrl}/messages`;

  private activeSubscriptions = new Map<number, Subscription>();
  
  // Subject para nuevos mensajes
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
    console.log(`🔌 Conectando usuario ${userId}...`);
    
    // Limpiar conexiones previas
    this.disconnect(userId);
    
    // Activar conexión STOMP si no está activa
    if (this.rxStomp.connectionState$.getValue() !== RxStompState.OPEN) {
      console.log('🔄 Activando conexión STOMP...');
      this.rxStomp.activate();
    }
    
    // Esperar a que la conexión esté establecida antes de suscribirse
    setTimeout(() => {
      this.subscribeToUserMessages(userId);
    }, 500);
  }

  private subscribeToUserMessages(userId: number): void {
    // Intentar ambos patrones de destino que podrías estar usando en el backend
    const destinations = [
      `/topic/private.${userId}`,
      `/user/${userId}/queue/messages`
    ];
    
    // Verificar si ya existe una suscripción para este usuario
    if (this.activeSubscriptions.has(userId)) {
      console.log(`ℹ️ Ya existe una suscripción activa para el usuario ${userId}`);
      return;
    }

    console.log(`📡 Estado WebSocket: ${this.rxStomp.connectionState$.getValue()}`);
    
    // Probar el primer destino (el que estás usando actualmente)
    const destination = destinations[0]; // `/topic/private.${userId}`
    console.log(`📡 Suscribiéndose a: ${destination}`);

    try {
      const subscription = this.rxStomp.watch(destination).subscribe({
        next: (message) => {
          console.log('🔔 Mensaje WebSocket recibido en', destination, ':', message);
          try {
            const chatMessage: ChatMessage = JSON.parse(message.body);
            console.log('🔥 MENSAJE PROCESADO:', chatMessage);
            
            // Emitir el mensaje (el componente se encargará del filtrado)
            this.newMessageSubject.next(chatMessage);
            
          } catch (e) {
            console.error('❌ Error procesando mensaje:', e);
          }
        },
        error: (error) => {
          console.error('❌ ERROR EN SUSCRIPCIÓN:', error);
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
      console.log(`✅ SUSCRIPCIÓN ACTIVA para usuario ${userId} en ${destination}`);
      
    } catch (error) {
      console.error('❌ Error creando suscripción:', error);
      // Reintentar después de un error
      setTimeout(() => this.subscribeToUserMessages(userId), 2000);
    }
  }

  disconnect(userId: number): void {
    console.log(`🔌 Desconectando usuario ${userId}...`);
    const sub = this.activeSubscriptions.get(userId);
    if (sub) { 
      sub.unsubscribe(); 
      this.activeSubscriptions.delete(userId);
      console.log(`✅ Usuario ${userId} desconectado`);
    }
  }

  sendPrivateMessage(message: ChatMessage): void {
    console.log('📤 Enviando mensaje:', message);
    
    if (this.rxStomp.connectionState$.getValue() !== RxStompState.OPEN) {
      console.error('❌ WebSocket no está conectado');
      return;
    }

    try {
      // Asegurar que el tipo esté definido
      const messageToSend = {
        ...message,
        type: message.type || 'CHAT'
      };
      
      this.rxStomp.publish({
        destination: '/app/chat.sendPrivateMessage',
        body: JSON.stringify(messageToSend),
        headers: { 
          'content-type': 'application/json',
          'message-type': message.type // Header adicional
        }
      });
    } catch (error) {
      console.error('❌ Error enviando mensaje:', error);
      // Reconectar si hay error
      setTimeout(() => this.connect(message.senderId), 2000);
    }
  }

  getMessageHistory(senderId: number, receiverId: number): Observable<ChatMessage[]> {
    console.log(`📜 Cargando historial: ${senderId} <-> ${receiverId}`);
    return this.http.get<ChatMessage[]>(`${this.historyUrl}/${senderId}/${receiverId}`);
  }

  // Método para debug - verificar estado de conexiones
  getActiveSubscriptions(): number[] {
    return Array.from(this.activeSubscriptions.keys());
  }

  // Método para forzar reconexión
  forceReconnect(userId: number): void {
    console.log('🔄 Forzando reconexión...');
    this.disconnect(userId);
    setTimeout(() => this.connect(userId), 1000);
  }
}