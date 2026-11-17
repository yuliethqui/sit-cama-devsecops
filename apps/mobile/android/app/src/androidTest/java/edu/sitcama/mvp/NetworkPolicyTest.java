package edu.sitcama.mvp;

import android.content.pm.ApplicationInfo;
import android.security.NetworkSecurityPolicy;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;

@RunWith(AndroidJUnit4.class)
public class NetworkPolicyTest {
    @Test
    public void cleartextIsLimitedToEmulatorHostInDebug() {
        boolean debug = (InstrumentationRegistry.getInstrumentation().getTargetContext()
            .getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0;
        NetworkSecurityPolicy policy = NetworkSecurityPolicy.getInstance();
        assertEquals(debug, policy.isCleartextTrafficPermitted("10.0.2.2"));
        assertFalse(policy.isCleartextTrafficPermitted("example.test"));
        assertFalse(policy.isCleartextTrafficPermitted("10.0.2.3"));
        assertFalse(policy.isCleartextTrafficPermitted("127.0.0.1"));
        assertFalse(policy.isCleartextTrafficPermitted("localhost"));
    }
}
