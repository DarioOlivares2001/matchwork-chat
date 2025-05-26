import { RxStompConfig } from '@stomp/rx-stomp';

export const stompConfig: RxStompConfig = {
  brokerURL: 'ws://localhost:8082/ws',
  connectHeaders: {
    'heart-beat': '10000,10000',
    'accept-version': '1.2',
    'content-type': 'application/json'
  },
  heartbeatIncoming: 10000,
  heartbeatOutgoing: 10000,
  reconnectDelay: 5000,
  debug: (msg: string) => console.log('STOMP:', msg)
};