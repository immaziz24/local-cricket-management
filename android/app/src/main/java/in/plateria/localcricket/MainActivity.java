package in.plateria.localcricket;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

public final class MainActivity extends Activity {
    private static final String HOST = "localcricket.plateria.in";
    private WebView website;

    @Override
    protected void onCreate(Bundle savedState) {
        super.onCreate(savedState);
        website = new WebView(this);
        website.getSettings().setJavaScriptEnabled(true);
        website.getSettings().setDomStorageEnabled(true);
        website.getSettings().setAllowFileAccess(false);
        website.getSettings().setAllowContentAccess(false);
        website.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri url = request.getUrl();
                if ("https".equals(url.getScheme()) && HOST.equals(url.getHost())) return false;
                if (request.isForMainFrame() && request.hasGesture()
                        && ("https".equals(url.getScheme()) || "mailto".equals(url.getScheme())
                        || "tel".equals(url.getScheme()))) {
                    try {
                        startActivity(new Intent(Intent.ACTION_VIEW, url));
                    } catch (ActivityNotFoundException exception) {
                        Toast.makeText(MainActivity.this, "No app can open this link.", Toast.LENGTH_SHORT).show();
                    }
                }
                return true;
            }
        });
        setContentView(website);
        if (savedState == null || website.restoreState(savedState) == null) {
            website.loadUrl("https://" + HOST + "/");
        }
    }

    @Override
    protected void onSaveInstanceState(Bundle state) {
        website.saveState(state);
        super.onSaveInstanceState(state);
    }

    @Override
    public void onBackPressed() {
        if (website.canGoBack()) website.goBack();
        else super.onBackPressed();
    }
}
