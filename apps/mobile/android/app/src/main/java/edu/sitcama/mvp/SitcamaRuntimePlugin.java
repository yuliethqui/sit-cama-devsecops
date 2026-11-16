package edu.sitcama.mvp;

import android.content.pm.ApplicationInfo;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "SitcamaRuntime")
public class SitcamaRuntimePlugin extends Plugin {
    @PluginMethod
    public void read(PluginCall call) {
        JSObject result = new JSObject();
        result.put("debuggable", (getContext().getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0);
        call.resolve(result);
    }
}
