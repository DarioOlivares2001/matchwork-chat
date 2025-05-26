import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { RxStomp } from '@stomp/rx-stomp';
import { stompConfig } from './config/stomp.config';

import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideHttpClient(),
   /* {
      provide: RxStomp,
      useFactory: () => {
        const rxStomp = new RxStomp();
        rxStomp.configure(stompConfig);
        rxStomp.activate();
        return rxStomp;
      }
    }*/
  ]
};
