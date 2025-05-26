import './polyfills';
import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { appConfig } from './app/app.config';

// Imports corregidos - usando solo @stomp/rx-stomp
import { RxStomp } from '@stomp/rx-stomp';
import { stompConfig } from './app/config/stomp.config';

bootstrapApplication(AppComponent, {
  ...appConfig,
  providers: [
    ...appConfig.providers,
    // ya tienes provideRouter, provideHttpClient...
    {
      provide: RxStomp,
      useFactory: () => {
        const rxStomp = new RxStomp();
        rxStomp.configure(stompConfig);
        rxStomp.activate();
        return rxStomp;
      }
    }
  ]
})
.catch(err => console.error(err));