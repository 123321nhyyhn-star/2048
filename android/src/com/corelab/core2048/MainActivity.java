package com.corelab.core2048;

import android.app.Activity;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.os.VibratorManager;
import android.view.View;
import android.view.WindowInsets;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.window.OnBackInvokedDispatcher;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.util.Collections;

/** Offline Android host for the same CORE 2048 game used by the HarmonyOS app. */
public final class MainActivity extends Activity {
    private static final String ORIGIN_HOST = "appassets.androidplatform.net";
    private static final String ENTRY = "https://" + ORIGIN_HOST + "/assets/index.html";
    private WebView web;
    private boolean handlingBack;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().getDecorView().setSystemUiVisibility(
            View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR | View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR);
        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.rgb(238, 238, 233));
        // Android 15 enforces edge-to-edge. Keep game controls clear of system bars/cutouts.
        if (Build.VERSION.SDK_INT >= 30) {
            getWindow().setDecorFitsSystemWindows(false);
            root.setOnApplyWindowInsetsListener((view, insets) -> {
                android.graphics.Insets safe = insets.getInsets(
                    WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout());
                view.setPadding(safe.left, safe.top, safe.right, safe.bottom);
                return WindowInsets.CONSUMED;
            });
        } else {
            root.setFitsSystemWindows(true);
        }
        web = new WebView(this);
        web.setBackgroundColor(Color.rgb(238, 238, 233));
        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setBlockNetworkLoads(true);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setMediaPlaybackRequiresUserGesture(true);
        settings.setTextZoom(100);
        settings.setSupportMultipleWindows(false);
        CookieManager.getInstance().setAcceptThirdPartyCookies(web, false);
        web.addJavascriptInterface(new CoreBridge(), "CoreNative");
        web.setWebViewClient(new LocalContent());
        root.addView(web, new FrameLayout.LayoutParams(-1, -1));
        setContentView(root);
        root.requestApplyInsets();
        if (Build.VERSION.SDK_INT >= 33) {
            getOnBackInvokedDispatcher().registerOnBackInvokedCallback(
                OnBackInvokedDispatcher.PRIORITY_DEFAULT, this::handleBack);
        }
        web.loadUrl(ENTRY);
    }

    /** Serve only a bounded list of bundled assets; no file URLs or external pages. */
    private final class LocalContent extends WebViewClient {
        @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            return !isLocal(request.getUrl());
        }
        @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
            Uri uri = request.getUrl();
            if (!isLocal(uri) || !"GET".equals(request.getMethod())) return missing();
            String file = uri.getPath().substring("/assets/".length());
            String mime;
            switch (file) {
                case "index.html": mime = "text/html"; break;
                case "icon.svg": mime = "image/svg+xml"; break;
                default: return missing();
            }
            try {
                return new WebResourceResponse(mime, "UTF-8", 200, "OK",
                    Collections.singletonMap("Cache-Control", "no-store"), getAssets().open(file));
            } catch (IOException failure) { return missing(); }
        }
    }

    private static boolean isLocal(Uri uri) {
        return "https".equals(uri.getScheme()) && ORIGIN_HOST.equals(uri.getHost())
            && uri.getPort() == -1 && uri.getUserInfo() == null
            && ("/assets/index.html".equals(uri.getPath()) || "/assets/icon.svg".equals(uri.getPath()));
    }
    private static WebResourceResponse missing() {
        return new WebResourceResponse("text/plain", "UTF-8", 404, "Not Found",
            Collections.emptyMap(), new ByteArrayInputStream(new byte[0]));
    }

    public final class CoreBridge {
        private final SharedPreferences saves = getSharedPreferences("core2048", MODE_PRIVATE);
        @JavascriptInterface public String getPlatform() { return "Android"; }
        @JavascriptInterface public String getSave() { return saves.getString("core2048.v1", ""); }
        @JavascriptInterface public boolean saveGame(String serialized) {
            if (serialized == null || serialized.length() > 32768) return false;
            // Bridge runs on a worker thread. Commit completes before acknowledging persistence.
            return saves.edit().putString("core2048.v1", serialized).commit();
        }
        @JavascriptInterface public void impact(String kind) {
            final int duration = "heavy".equals(kind) ? 42 : "medium".equals(kind) ? 22 : 10;
            final int amplitude = "heavy".equals(kind) ? 220 : "medium".equals(kind) ? 150 : 80;
            runOnUiThread(() -> {
                if (isFinishing() || isDestroyed()) return;
                Vibrator vibrator = Build.VERSION.SDK_INT >= 31
                    ? getSystemService(VibratorManager.class).getDefaultVibrator()
                    : (Vibrator) getSystemService(VIBRATOR_SERVICE);
                if (vibrator != null && vibrator.hasVibrator()) {
                    vibrator.vibrate(VibrationEffect.createOneShot(duration, amplitude));
                }
            });
        }
    }

    private void event(String name) {
        if (web != null) web.evaluateJavascript("document.dispatchEvent(new Event('core:" + name + "'))", null);
    }
    @Override protected void onResume() {
        super.onResume();
        if (web != null) { web.onResume(); web.resumeTimers(); event("resume"); }
    }
    @Override protected void onPause() {
        event("pause");
        if (web != null) { web.onPause(); web.pauseTimers(); }
        super.onPause();
    }
    private void handleBack() {
        if (handlingBack || isFinishing()) return;
        if (web == null) { finish(); return; }
        handlingBack = true;
        web.evaluateJavascript("(() => { const dialog = document.getElementById('dialog'); "
            + "if (dialog && dialog.open) { document.dispatchEvent(new Event('core:back')); return 'closed'; } "
            + "document.dispatchEvent(new Event('core:pause')); return 'exit'; })()", result -> {
                handlingBack = false;
                if (!"\"closed\"".equals(result)) finish();
            });
    }
    @Override public void onBackPressed() { handleBack(); }
    @Override protected void onDestroy() {
        if (web != null) {
            web.stopLoading();
            web.removeJavascriptInterface("CoreNative");
            ((FrameLayout) web.getParent()).removeView(web);
            web.destroy();
            web = null;
        }
        super.onDestroy();
    }
}
