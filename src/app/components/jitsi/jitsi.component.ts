// src/app/components/jitsi/jitsi.component.ts
import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';

declare var JitsiMeetExternalAPI: any;

@Component({
  selector: 'app-jitsi',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="jitsi-overlay">
      <button class="close-btn" (click)="close.emit()">✕</button>
      <div id="jitsi-container" class="jitsi-container"></div>
    </div>
  `,
  styles: [`
    .jitsi-overlay {
      position: fixed;
      top:0; left:0; right:0; bottom:0;
      background: rgba(0,0,0,0.6);
      display: flex; align-items: center; justify-content: center;
      z-index: 1000;
    }
    .jitsi-container {
      width: 80vw;
      height: 80vh;
      border-radius: 8px;
      overflow: hidden;
    }
    .close-btn {
      position: absolute; top:1rem; right:1rem;
      background:#fff; border:none; font-size:1.5rem;
      border-radius:50%; width:2.5rem; height:2.5rem; cursor:pointer;
    }
  `]
})
export class JitsiComponent implements OnInit, OnDestroy {
  @Input() roomName!: string;
  @Output() close = new EventEmitter<void>();
  private api?: any;

  constructor(private zone: NgZone) {}

 ngOnInit() {
    this.zone.runOutsideAngular(() => {
      this.api = new JitsiMeetExternalAPI('meet.jit.si', {
        roomName: this.roomName,
        parentNode: document.getElementById('jitsi-container'),
        configOverwrite: {
          // Forzar características compatibles
          disableSimulcast: true,
          enableNoisyMicDetection: false,
          disableThirdPartyRequests: true
        },
        interfaceConfigOverwrite: {
          // Simplificar interfaz
          SHOW_JITSI_WATERMARK: false,
          SHOW_WATERMARK_FOR_GUESTS: false,
          TOOLBAR_BUTTONS: ['microphone', 'camera', 'hangup']
        }
      });
    });
  }

  ngOnDestroy() {
    this.api?.dispose();
  }
}
