import { webview } from '@kit.ArkWeb';
import { vibrator } from '@kit.SensorServiceKit';
import { BusinessError } from '@kit.BasicServicesKit';
import { common } from '@kit.AbilityKit';
import { CoreStore } from '../common/CoreStore';
import { CoreRuntime } from '../common/CoreRuntime';

// The local page can only request bounded haptics and its own bounded save string.
class CoreBridge {
  getSave(): string { return CoreStore.read(); }
  saveGame(data: string): boolean { return CoreStore.write(data); }
  impact(kind: string): void {
    const duration: number = kind === 'heavy' ? 42 : kind === 'medium' ? 22 : 10;
    try {
      vibrator.startVibration({ type: 'time', duration: duration }, { usage: 'touch' })
        .catch((error: BusinessError) => console.warn('CORE: Haptics unavailable: ' + error.code));
    } catch (error) {
      console.warn('CORE: Haptics unavailable');
    }
  }
}

@Entry
@Component
struct Index {
  private controller: webview.WebviewController = new webview.WebviewController();
  private bridge: CoreBridge = new CoreBridge();

  aboutToAppear(): void { CoreRuntime.controller = this.controller; }
  aboutToDisappear(): void { CoreRuntime.signal(false); CoreStore.flush(); }

  private exitSession(): void {
    CoreRuntime.signal(false);
    CoreStore.flush();
    const context = this.getUIContext().getHostContext() as common.UIAbilityContext;
    context.terminateSelf().catch(() => {});
  }

  onBackPress(): boolean {
    this.controller.runJavaScript("(() => { const dialog = document.getElementById('dialog'); if (dialog && dialog.open) { document.dispatchEvent(new Event('core:back')); return 'closed'; } document.dispatchEvent(new Event('core:pause')); return 'exit'; })()")
      .then((result: string) => {
        if (result.includes('exit')) {
          this.exitSession();
        }
      }).catch(() => { this.exitSession(); });
    return true;
  }

  build() {
    Column() {
      Web({ src: $rawfile('index.html'), controller: this.controller })
        .javaScriptAccess(true)
        .domStorageAccess(true)
        .zoomAccess(false)
        .mediaPlayGestureAccess(true)
        .javaScriptProxy({ object: this.bridge, name: 'CoreNative', methodList: ['impact', 'getSave', 'saveGame'], controller: this.controller })
        .width('100%')
        .height('100%')
    }
    .width('100%')
    .height('100%')
    .backgroundColor('#eeeee9')
  }
}
