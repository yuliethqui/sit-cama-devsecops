package edu.sitcama.mvp;

import android.content.pm.ApplicationInfo;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import io.socket.client.IO;
import io.socket.client.Socket;
import io.socket.engineio.client.transports.WebSocket;
import java.net.URI;
import java.util.Collections;
import org.json.JSONObject;

/** Debug-only native transport; the HTTPS WebView keeps mixed content disabled. */
@CapacitorPlugin(name = "SitcamaRealtime")
public class SitcamaRealtimePlugin extends Plugin {
    private Socket socket;

    @PluginMethod
    public synchronized void connect(PluginCall call) {
        close();
        String token = call.getString("token");
        if ((getContext().getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) == 0 ||
            token == null || token.length() > 4096) {
            call.reject("Transporte no disponible"); return;
        }
        IO.Options options = IO.Options.builder()
            .setForceNew(true).setTransports(new String[] { WebSocket.NAME })
            .setAuth(Collections.singletonMap("token", token))
            .setExtraHeaders(Collections.singletonMap("Origin", Collections.singletonList("https://localhost")))
            .setReconnection(true).setReconnectionDelay(1000).setReconnectionDelayMax(5000).build();
        final Socket current = IO.socket(URI.create("http://10.0.2.2:3000/triage"), options);
        socket = current;
        current.on(Socket.EVENT_CONNECT, args -> {
            if (socket != current) return;
            current.emit("triage:sync", new JSONObject()); state("connected");
        });
        current.on(Socket.EVENT_DISCONNECT, args -> {
            if (socket == current) state(args.length > 0 && "io server disconnect".equals(args[0]) ? "denied" : "disconnected");
        });
        current.on(Socket.EVENT_CONNECT_ERROR, args -> { if (socket == current) state("error"); });
        current.on("triage:changed", args -> {
            if (socket != current || args.length != 1 || !(args[0] instanceof JSONObject)) return;
            JSONObject event = (JSONObject) args[0];
            String id = event.optString("eventId", "");
            if (!id.matches("[a-f0-9-]{36}") || !(event.opt("criticalDemo") instanceof Boolean)) return;
            JSObject safe = new JSObject(); safe.put("eventId", id); safe.put("criticalDemo", event.optBoolean("criticalDemo"));
            notifyListeners("changed", safe);
        });
        current.connect(); call.resolve();
    }
    private void state(String status) { JSObject event = new JSObject(); event.put("status", status); notifyListeners("state", event); }
    private synchronized void close() { if (socket != null) { socket.off(); socket.disconnect(); socket = null; } }
    @PluginMethod public synchronized void disconnect(PluginCall call) { close(); call.resolve(); }
    @Override protected void handleOnDestroy() { close(); }
}
