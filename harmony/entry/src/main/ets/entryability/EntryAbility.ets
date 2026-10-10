import { UIAbility } from '@kit.AbilityKit';
import { window } from '@kit.ArkUI';
import { BusinessError } from '@kit.BasicServicesKit';
import { CoreStore } from '../common/CoreStore';
import { CoreRuntime } from '../common/CoreRuntime';

export default class EntryAbility extends UIAbility {
  onWindowStageCreate(windowStage: window.WindowStage): void {
    CoreStore.initialize(this.context);
    windowStage.loadContent('pages/Index', (error: BusinessError) => {
      if (error.code) console.error('CORE: Failed to load page: ' + error.message);
    });
    windowStage.getMainWindow().then(async (mainWindow: window.Window) => {
      await mainWindow.setWindowLayoutFullScreen(false);
      await mainWindow.setWindowSystemBarProperties({
        statusBarColor: '#eeeee9', statusBarContentColor: '#262c28',
        navigationBarColor: '#e9ebe2', navigationBarContentColor: '#262c28'
      });
    }).catch((error: BusinessError) => console.warn('CORE: System bars: ' + error.message));
  }

  onForeground(): void { CoreRuntime.signal(true); }
  onBackground(): void { CoreRuntime.signal(false); CoreStore.flush(); }
  onDestroy(): void { CoreStore.flush(); CoreRuntime.controller = null; }
}
