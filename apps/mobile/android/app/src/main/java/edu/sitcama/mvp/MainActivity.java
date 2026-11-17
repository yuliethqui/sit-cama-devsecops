package edu.sitcama.mvp;

import com.getcapacitor.BridgeActivity;
import android.os.Bundle;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(SitcamaRuntimePlugin.class);
        registerPlugin(SitcamaRealtimePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
