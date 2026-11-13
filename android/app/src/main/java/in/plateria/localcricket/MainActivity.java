package in.plateria.localcricket;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.view.WindowInsets;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;
import android.widget.Button;
import android.widget.LinearLayout;

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
        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setOnApplyWindowInsetsListener((view, insets) -> {
            if (android.os.Build.VERSION.SDK_INT >= 30) {
                android.graphics.Insets bars = insets.getInsets(WindowInsets.Type.systemBars()
                        | WindowInsets.Type.displayCutout() | WindowInsets.Type.ime());
                view.setPadding(bars.left, bars.top, bars.right, bars.bottom);
            }
            return insets;
        });
        layout.addView(website, new LinearLayout.LayoutParams(-1, 0, 1));
        LinearLayout navigation = new LinearLayout(this);
        addDestination(navigation, "Matches", "matches");
        addDestination(navigation, "Tournaments", "tournaments");
        addDestination(navigation, "Account", "settings");
        layout.addView(navigation);
        setContentView(layout);
        if (savedState == null || website.restoreState(savedState) == null) {
            website.loadUrl("https://" + HOST + "/");
        }
    }

    private void addDestination(LinearLayout navigation, String label, String page) {
        Button button = new Button(this);
        button.setText(label);
        button.setAllCaps(false);
        button.setOnClickListener(view -> website.loadUrl("https://" + HOST + "/?page=" + page));
        navigation.addView(button, new LinearLayout.LayoutParams(0, -2, 1));
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
