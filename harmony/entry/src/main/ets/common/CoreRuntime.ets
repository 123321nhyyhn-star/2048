import { webview } from '@kit.ArkWeb';

export class CoreRuntime {
  static controller: webview.WebviewController | null = null;

  static signal(active: boolean): void {
    const event: string = active ? 'core:resume' : 'core:pause';
    try {
      CoreRuntime.controller?.runJavaScript("document.dispatchEvent(new Event('" + event + "'));" )
        .catch(() => {});
    } catch (error) { /* The page may not yet be attached or may be closing. */ }
  }
}
