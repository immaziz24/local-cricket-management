package in.plateria.localcricket;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.content.ContentValues;
import android.provider.MediaStore;
import android.util.Base64;
import android.webkit.JavascriptInterface;
import java.io.IOException;
import java.io.OutputStream;
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
    private byte[] pendingLineup;
    private static final int SAVE_LINEUP = 31;

    @Override
    protected void onCreate(Bundle savedState) {
        super.onCreate(savedState);
        website = new WebView(this);
        website.getSettings().setJavaScriptEnabled(true);
        website.getSettings().setDomStorageEnabled(true);
        website.getSettings().setAllowFileAccess(false);
        website.getSettings().setAllowContentAccess(false);
        website.addJavascriptInterface(new LineupDownloads(), "CricnotchDownloads");
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

    private final class LineupDownloads {
        @JavascriptInterface
        public void saveLineup(String image) {
            String prefix = "data:image/png;base64,";
            if (image == null || !image.startsWith(prefix) || image.length() > 8_000_000) return;
            try {
                byte[] bytes = Base64.decode(image.substring(prefix.length()), Base64.DEFAULT);
                if (bytes.length < 8 || bytes[0] != (byte) 137 || bytes[1] != 80
                        || bytes[2] != 78 || bytes[3] != 71) return;
                if (android.os.Build.VERSION.SDK_INT >= 29) {
                    saveToDownloads(bytes);
                    return;
                }
                runOnUiThread(() -> {
                    if (pendingLineup != null) return;
                    pendingLineup = bytes;
                    Intent save = new Intent(Intent.ACTION_CREATE_DOCUMENT)
                            .addCategory(Intent.CATEGORY_OPENABLE)
                            .setType("image/png")
                            .putExtra(Intent.EXTRA_TITLE, "cricnotch-playing-xi.png");
                    try {
                        startActivityForResult(save, SAVE_LINEUP);
                    } catch (ActivityNotFoundException exception) {
                        pendingLineup = null;
                        Toast.makeText(MainActivity.this, "No file picker is available.", Toast.LENGTH_SHORT).show();
                    }
                });
            } catch (IllegalArgumentException ignored) {
                // An invalid image cannot be exported.
            }
        }
    }

    private void saveToDownloads(byte[] bytes) {
        Uri destination = null;
        try {
            ContentValues values = new ContentValues();
            values.put(MediaStore.Downloads.DISPLAY_NAME, "cricnotch-playing-xi-" + System.currentTimeMillis() + ".png");
            values.put(MediaStore.Downloads.MIME_TYPE, "image/png");
            values.put(MediaStore.Downloads.IS_PENDING, 1);
            destination = getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
            if (destination == null) throw new IOException("Could not create download");
            try (OutputStream output = getContentResolver().openOutputStream(destination)) {
                if (output == null) throw new IOException("Could not open download");
                output.write(bytes);
            }
            values.clear();
            values.put(MediaStore.Downloads.IS_PENDING, 0);
            getContentResolver().update(destination, values, null, null);
            runOnUiThread(() -> Toast.makeText(this, "Saved to Downloads.", Toast.LENGTH_SHORT).show());
        } catch (IOException | RuntimeException exception) {
            if (destination != null) {
                try {
                    getContentResolver().delete(destination, null, null);
                } catch (RuntimeException ignored) {
                    // Storage may no longer be available.
                }
            }
            runOnUiThread(() -> Toast.makeText(this, "Could not save the lineup.", Toast.LENGTH_SHORT).show());
        }
    }

    @Override
    protected void onActivityResult(int request, int result, Intent data) {
        super.onActivityResult(request, result, data);
        if (request != SAVE_LINEUP) return;
        byte[] bytes = pendingLineup;
        pendingLineup = null;
        if (result != RESULT_OK || data == null || data.getData() == null || bytes == null) return;
        try (OutputStream output = getContentResolver().openOutputStream(data.getData())) {
            if (output == null) throw new IOException("Could not open destination");
            output.write(bytes);
            Toast.makeText(this, "Playing XI saved.", Toast.LENGTH_SHORT).show();
        } catch (IOException | SecurityException exception) {
            Toast.makeText(this, "Could not save the lineup.", Toast.LENGTH_SHORT).show();
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
