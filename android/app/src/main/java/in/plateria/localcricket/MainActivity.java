package in.plateria.localcricket;

import android.Manifest;
import android.content.pm.PackageManager;
import android.webkit.GeolocationPermissions;
import android.webkit.WebChromeClient;
import android.webkit.ValueCallback;

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
import android.widget.LinearLayout;

public final class MainActivity extends Activity {
    private static final String HOST = "localcricket.plateria.in";
    private WebView website;
    private static final int LOCATION_PERMISSION = 32;
    private GeolocationPermissions.Callback locationCallback;
    private String locationOrigin;
    private byte[] pendingLineup;
    private static final int SAVE_LINEUP = 31;
    private static final int PICK_FILE = 33;
    private ValueCallback<Uri[]> fileCallback;
    private Uri capturedPhoto;

    @Override
    protected void onCreate(Bundle savedState) {
        super.onCreate(savedState);
        website = new WebView(this);
        website.getSettings().setJavaScriptEnabled(true);
        website.getSettings().setDomStorageEnabled(true);
        website.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = callback;
                try {
                    Intent files = params.createIntent();
                    if (android.os.Build.VERSION.SDK_INT >= 29
                            && java.util.Arrays.stream(params.getAcceptTypes()).anyMatch(type -> type.startsWith("image/"))) {
                        ContentValues photo = new ContentValues();
                        photo.put(MediaStore.Images.Media.DISPLAY_NAME, "cricnotch-camera-" + System.currentTimeMillis() + ".jpg");
                        photo.put(MediaStore.Images.Media.MIME_TYPE, "image/jpeg");
                        capturedPhoto = getContentResolver().insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, photo);
                        if (capturedPhoto != null) {
                            Intent camera = new Intent(MediaStore.ACTION_IMAGE_CAPTURE)
                                    .putExtra(MediaStore.EXTRA_OUTPUT, capturedPhoto)
                                    .addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION | Intent.FLAG_GRANT_READ_URI_PERMISSION);
                            camera.setClipData(android.content.ClipData.newRawUri("Photo", capturedPhoto));
                            files = Intent.createChooser(files, "Choose a photo")
                                    .putExtra(Intent.EXTRA_INITIAL_INTENTS, new Intent[]{camera});
                        }
                    }
                    startActivityForResult(files, PICK_FILE);
                } catch (ActivityNotFoundException exception) {
                    if (capturedPhoto != null) getContentResolver().delete(capturedPhoto, null, null);
                    capturedPhoto = null;
                    fileCallback = null;
                    callback.onReceiveValue(null);
                }
                return true;
            }

            @Override
            public void onGeolocationPermissionsShowPrompt(String origin, GeolocationPermissions.Callback callback) {
                if (!("https://" + HOST).equals(origin) || locationCallback != null) {
                    callback.invoke(origin, false, false);
                } else if (checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED) {
                    callback.invoke(origin, true, false);
                } else {
                    locationCallback = callback;
                    locationOrigin = origin;
                    requestPermissions(new String[]{Manifest.permission.ACCESS_COARSE_LOCATION}, LOCATION_PERMISSION);
                }
            }
        });
        website.getSettings().setAllowFileAccess(false);
        website.getSettings().setAllowContentAccess(false);
        website.addJavascriptInterface(new LineupDownloads(), "CricnotchDownloads");
        website.addJavascriptInterface(new LinkSharing(), "CricnotchSharing");
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
                // The root already accounts for the keyboard. Do not resize WebView again.
                return WindowInsets.CONSUMED;
            }
            return insets;
        });
        layout.addView(website, new LinearLayout.LayoutParams(-1, 0, 1));
        setContentView(layout);
        if (savedState == null || website.restoreState(savedState) == null) {
            openLink(getIntent());
        }
    }

    @Override
    public void onRequestPermissionsResult(int request, String[] permissions, int[] results) {
        super.onRequestPermissionsResult(request, permissions, results);
        if (request != LOCATION_PERMISSION || locationCallback == null) return;
        locationCallback.invoke(locationOrigin, results.length > 0 && results[0] == PackageManager.PERMISSION_GRANTED, false);
        locationCallback = null;
        locationOrigin = null;
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        openLink(intent);
    }

    private void openLink(Intent intent) {
        Uri link = intent.getData();
        if (Intent.ACTION_VIEW.equals(intent.getAction()) && link != null
                && "https".equals(link.getScheme()) && HOST.equals(link.getHost())
                && (link.getPort() == -1 || link.getPort() == 443)) {
            website.loadUrl(link.toString());
        } else {
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
        if (request == PICK_FILE && fileCallback != null) {
            ValueCallback<Uri[]> callback = fileCallback;
            fileCallback = null;
            Uri[] files = WebChromeClient.FileChooserParams.parseResult(result, data);
            if (capturedPhoto != null) {
                if (result == RESULT_OK && files == null) {
                    try (android.os.ParcelFileDescriptor photo = getContentResolver().openFileDescriptor(capturedPhoto, "r")) {
                        if (photo != null && photo.getStatSize() > 0) files = new Uri[]{capturedPhoto};
                    } catch (IOException ignored) {
                        // The camera did not produce a readable photo.
                    }
                }
                if (files == null || !capturedPhoto.equals(files[0])) {
                    getContentResolver().delete(capturedPhoto, null, null);
                }
                capturedPhoto = null;
            }
            callback.onReceiveValue(files);
            return;
        }
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

    private final class LinkSharing {
        @JavascriptInterface
        public void shareLink(String title, String address) {
            if (address == null || address.length() > 2048) return;
            Uri link = Uri.parse(address);
            if (!"https".equals(link.getScheme()) || !HOST.equals(link.getHost())
                    || link.getUserInfo() != null || (link.getPort() != -1 && link.getPort() != 443)) return;
            runOnUiThread(() -> {
                Intent share = new Intent(Intent.ACTION_SEND).setType("text/plain")
                        .putExtra(Intent.EXTRA_TEXT, link.toString());
                startActivity(Intent.createChooser(share, title == null ? "Share" : title.substring(0, Math.min(title.length(), 100))));
            });
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
