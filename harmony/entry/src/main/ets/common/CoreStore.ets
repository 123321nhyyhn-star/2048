import { preferences } from '@kit.ArkData';
import { common } from '@kit.AbilityKit';
import { BusinessError } from '@kit.BasicServicesKit';

export class CoreStore {
  private static store: preferences.Preferences | null = null;

  static initialize(context: common.UIAbilityContext): void {
    try {
      CoreStore.store = preferences.getPreferencesSync(context, { name: 'core2048' });
    } catch (error) {
      console.warn('CORE: Native storage unavailable; web backup will be used.');
    }
  }

  static read(): string {
    try {
      const data: preferences.ValueType = CoreStore.store?.getSync('save.v1', '') ?? '';
      return typeof data === 'string' ? data : '';
    } catch (error) { return ''; }
  }

  static write(data: string): boolean {
    if (!CoreStore.store || data.length === 0 || data.length > 32768) return false;
    try {
      CoreStore.store.putSync('save.v1', data);
      CoreStore.flush();
      return true;
    } catch (error) { return false; }
  }

  static flush(): void {
    if (CoreStore.store) {
      CoreStore.store.flush().catch((error: BusinessError) => {
        console.warn('CORE: Native save flush failed: ' + error.code);
      });
    }
  }
}
