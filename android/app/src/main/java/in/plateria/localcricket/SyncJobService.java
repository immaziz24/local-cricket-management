package in.plateria.localcricket;

import android.app.job.JobInfo;
import android.app.job.JobParameters;
import android.app.job.JobScheduler;
import android.app.job.JobService;
import android.content.ComponentName;
import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * #289 Background synchronisation. When the scorer was offline and closed the app, this job uploads the queued
 * balls and player changes as soon as the internet is back. It only talks to the app's own Supabase address and only
 * uses the sign-in that was saved when the app was closed (it does not refresh it, so about one hour). The server
 * ignores a ball it has already recorded, so nothing can be counted twice.
 */
public final class SyncJobService extends JobService {
    static final String PREFS = "cricnotch_sync";
    static final String SUPABASE_HOST = "cwdkvjweuyvednvoyaum.supabase.co";
    static final Object LOCK = new Object();
    private static final int JOB_ID = 2891;
    private volatile Thread worker;

    static boolean hasPending(Context context) {
        synchronized (LOCK) {
            for (String key : context.getSharedPreferences(PREFS, MODE_PRIVATE).getAll().keySet()) {
                if (key.startsWith("pending_")) return true;
            }
        }
        return false;
    }

    static void schedule(Context context) {
        if (!hasPending(context)) return;
        JobScheduler scheduler = context.getSystemService(JobScheduler.class);
        if (scheduler == null) return;
        scheduler.schedule(new JobInfo.Builder(JOB_ID, new ComponentName(context, SyncJobService.class))
                .setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY)
                .setBackoffCriteria(60_000, JobInfo.BACKOFF_POLICY_EXPONENTIAL)
                .build());
    }

    @Override
    public boolean onStartJob(JobParameters params) {
        // The open screen already syncs by itself.
        if (MainActivity.foreground) return false;
        worker = new Thread(() -> {
            boolean again;
            try {
                again = syncAll();
            } catch (Exception exception) {
                again = true;
            }
            jobFinished(params, again);
        });
        worker.start();
        return true;
    }

    @Override
    public boolean onStopJob(JobParameters params) {
        Thread running = worker;
        if (running != null) running.interrupt();
        return true;
    }

    /** Returns true when the job should be tried again later. */
    private boolean syncAll() throws Exception {
        SharedPreferences prefs = getSharedPreferences(PREFS, MODE_PRIVATE);
        List<String> matches = new ArrayList<>();
        synchronized (LOCK) {
            for (Map.Entry<String, ?> entry : prefs.getAll().entrySet()) {
                if (entry.getKey().startsWith("pending_")) matches.add(entry.getKey().substring(8));
            }
        }
        boolean again = false;
        for (String matchId : matches) {
            if (Thread.currentThread().isInterrupted()) return true;
            String text;
            synchronized (LOCK) { text = prefs.getString("pending_" + matchId, null); }
            if (text == null) continue;
            JSONObject pending = new JSONObject(text);
            long expires = pending.optLong("exp", 0);
            // A sign-in that has run out cannot upload. The balls stay until the app is opened.
            if (expires > 0 && System.currentTimeMillis() / 1000 >= expires - 30) continue;
            URL base = new URL(pending.getString("url"));
            if (!"https".equals(base.getProtocol()) || !SUPABASE_HOST.equals(base.getHost())) continue;
            JSONArray actions = pending.getJSONArray("actions");
            for (int i = 0; i < actions.length(); i++) {
                JSONObject action = actions.getJSONObject(i);
                int code = send(base, pending.getString("key"), pending.getString("token"), matchId, action);
                if (code >= 200 && code < 300) {
                    markSent(matchId, action.getString("id"));
                } else {
                    // No connection, busy server or a timeout: try again later. Anything else needs the scorer.
                    if (code == -1 || code == 408 || code == 429 || code >= 500) again = true;
                    break;
                }
            }
        }
        return again;
    }

    private int send(URL base, String key, String token, String matchId, JSONObject action) {
        HttpURLConnection connection = null;
        try {
            JSONObject payload = action.getJSONObject("payload");
            JSONObject body = new JSONObject();
            String function;
            body.put("p_match_id", matchId);
            if ("ball".equals(action.getString("kind"))) {
                function = "record_ball";
                body.put("p", payload);
            } else {
                function = "set_innings_players";
                body.put("p_striker", payload.isNull("striker") ? JSONObject.NULL : payload.opt("striker"));
                body.put("p_non_striker", payload.isNull("nonStriker") ? JSONObject.NULL : payload.opt("nonStriker"));
                body.put("p_bowler", payload.isNull("bowler") ? JSONObject.NULL : payload.opt("bowler"));
            }
            connection = (HttpURLConnection) new URL(base, "/rest/v1/rpc/" + function).openConnection();
            connection.setRequestMethod("POST");
            connection.setConnectTimeout(15_000);
            connection.setReadTimeout(20_000);
            connection.setDoOutput(true);
            connection.setRequestProperty("apikey", key);
            connection.setRequestProperty("Authorization", "Bearer " + token);
            connection.setRequestProperty("Content-Type", "application/json");
            try (OutputStream output = connection.getOutputStream()) {
                output.write(body.toString().getBytes(StandardCharsets.UTF_8));
            }
            return connection.getResponseCode();
        } catch (Exception exception) {
            return -1;
        } finally {
            if (connection != null) connection.disconnect();
        }
    }

    /** Remember the action as sent and take it off the waiting list. */
    private void markSent(String matchId, String id) {
        SharedPreferences prefs = getSharedPreferences(PREFS, MODE_PRIVATE);
        synchronized (LOCK) {
            try {
                String text = prefs.getString("pending_" + matchId, null);
                if (text == null) return;
                JSONObject pending = new JSONObject(text);
                JSONArray left = new JSONArray();
                JSONArray actions = pending.getJSONArray("actions");
                for (int i = 0; i < actions.length(); i++) {
                    if (!id.equals(actions.getJSONObject(i).getString("id"))) left.put(actions.getJSONObject(i));
                }
                JSONArray sent = new JSONArray(prefs.getString("sent_" + matchId, "[]"));
                sent.put(id);
                SharedPreferences.Editor editor = prefs.edit().putString("sent_" + matchId, sent.toString());
                if (left.length() == 0) {
                    editor.remove("pending_" + matchId);
                } else {
                    pending.put("actions", left);
                    editor.putString("pending_" + matchId, pending.toString());
                }
                editor.apply();
            } catch (Exception ignored) {
                // A damaged entry is dropped by the next sync from the screen.
            }
        }
    }
}
