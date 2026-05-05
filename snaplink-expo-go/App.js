import * as Clipboard from 'expo-clipboard';
import * as Linking from 'expo-linking';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { WebView } from 'react-native-webview';

const SNAPLINK_URL = 'https://snaplinknetwork.netlify.app/?source=expo-go';
const INSTALL_URL = 'https://snaplinknetwork.netlify.app/install';

export default function App() {
  const webviewRef = React.useRef(null);
  const [canGoBack, setCanGoBack] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState(false);

  React.useEffect(() => {
    if (Platform.OS !== 'android') return undefined;

    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (canGoBack) {
        webviewRef.current?.goBack();
        return true;
      }

      return false;
    });

    return () => subscription.remove();
  }, [canGoBack]);

  const copyLink = async () => {
    await Clipboard.setStringAsync(INSTALL_URL);
    Alert.alert('SnapLink link copied', 'Open it in Safari if you want the Home Screen app version too.');
  };

  const openInSafari = async () => {
    await Linking.openURL(SNAPLINK_URL);
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Pressable
            onPress={() => (canGoBack ? webviewRef.current?.goBack() : webviewRef.current?.reload())}
            style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
          >
            <Text style={styles.iconText}>{canGoBack ? '<' : '↻'}</Text>
          </Pressable>
          <View style={styles.brand}>
            <Text style={styles.eyebrow}>SNAPLINK</Text>
            <Text style={styles.title}>Mobile Preview</Text>
          </View>
          <Pressable onPress={copyLink} style={({ pressed }) => [styles.installButton, pressed && styles.pressed]}>
            <Text style={styles.installText}>Install</Text>
          </Pressable>
        </View>

        <View style={styles.webShell}>
          {isLoading && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator color="#38d9ff" size="large" />
              <Text style={styles.loadingText}>Opening SnapLink...</Text>
            </View>
          )}

          {loadError ? (
            <View style={styles.errorState}>
              <Text style={styles.errorTitle}>SnapLink could not load</Text>
              <Text style={styles.errorBody}>Check your internet, then retry. If Expo Go blocks the page, open SnapLink in Safari.</Text>
              <Pressable onPress={() => { setLoadError(false); setIsLoading(true); webviewRef.current?.reload(); }} style={styles.primaryAction}>
                <Text style={styles.primaryActionText}>Retry</Text>
              </Pressable>
              <Pressable onPress={openInSafari} style={styles.secondaryAction}>
                <Text style={styles.secondaryActionText}>Open in Safari</Text>
              </Pressable>
            </View>
          ) : (
            <WebView
              ref={webviewRef}
              source={{ uri: SNAPLINK_URL }}
              style={styles.webview}
              originWhitelist={['*']}
              javaScriptEnabled
              domStorageEnabled
              sharedCookiesEnabled
              thirdPartyCookiesEnabled
              allowsInlineMediaPlayback
              mediaPlaybackRequiresUserAction={false}
              pullToRefreshEnabled
              onNavigationStateChange={(event) => setCanGoBack(event.canGoBack)}
              onLoadStart={() => setIsLoading(true)}
              onLoadEnd={() => setIsLoading(false)}
              onError={() => {
                setLoadError(true);
                setIsLoading(false);
              }}
              onHttpError={(event) => {
                if (event.nativeEvent.statusCode >= 500) {
                  setLoadError(true);
                  setIsLoading(false);
                }
              }}
            />
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#020617',
  },
  safeArea: {
    flex: 1,
    backgroundColor: '#020617',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingTop: Platform.OS === 'android' ? 30 : 8,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(148, 163, 184, 0.22)',
    backgroundColor: '#020617',
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  iconText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '900',
  },
  brand: {
    flex: 1,
  },
  eyebrow: {
    color: '#38d9ff',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 3,
  },
  title: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: -0.4,
  },
  installButton: {
    minWidth: 82,
    height: 42,
    paddingHorizontal: 16,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  installText: {
    color: '#020617',
    fontWeight: '900',
  },
  pressed: {
    opacity: 0.74,
    transform: [{ scale: 0.98 }],
  },
  webShell: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  webview: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: '#020617',
  },
  loadingText: {
    color: '#cbd5e1',
    fontWeight: '800',
  },
  errorState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#020617',
  },
  errorTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '900',
    textAlign: 'center',
  },
  errorBody: {
    marginTop: 12,
    color: '#94a3b8',
    lineHeight: 22,
    textAlign: 'center',
  },
  primaryAction: {
    marginTop: 24,
    width: '100%',
    borderRadius: 999,
    backgroundColor: '#38d9ff',
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryActionText: {
    color: '#020617',
    fontWeight: '900',
  },
  secondaryAction: {
    marginTop: 10,
    width: '100%',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    paddingVertical: 14,
    alignItems: 'center',
  },
  secondaryActionText: {
    color: '#fff',
    fontWeight: '900',
  },
});
