package edu.sitcama.mvp;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** Release cannot instantiate the emulator HTTP transport. HTTPS uses the JS WSS client. */
@CapacitorPlugin(name = "SitcamaRealtime")
public class SitcamaRealtimePlugin extends Plugin {
    @PluginMethod public void connect(PluginCall call) { call.reject("Transporte no disponible"); }
    @PluginMethod public void disconnect(PluginCall call) { call.resolve(); }
}
