import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider } from '../src/AuthContext';
import { CartProvider } from '../src/CartContext';
import { I18nProvider } from '../src/i18n';
import ResponsiveFrame from '../src/components/ResponsiveFrame';
import PwaInstaller from '../src/components/PwaInstaller';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <I18nProvider>
          <AuthProvider>
            <CartProvider>
              <StatusBar style="dark" />
              <ResponsiveFrame>
                <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#F9FAFB' } }}>
                  <Stack.Screen name="index" />
                  <Stack.Screen name="(auth)" />
                  <Stack.Screen name="(tabs)" />
                  <Stack.Screen name="product/[id]" options={{ presentation: 'card' }} />
                  <Stack.Screen name="cart" />
                  <Stack.Screen name="checkout" />
                  <Stack.Screen name="news" />
                  <Stack.Screen name="offers" />
                  <Stack.Screen name="support" />
                  <Stack.Screen name="dealers" />
                  <Stack.Screen name="admin" />
                  <Stack.Screen name="admin-products" />
                  <Stack.Screen name="admin-console" />
                  <Stack.Screen name="dealer-portal" />
                  <Stack.Screen name="social" />
                </Stack>
                <PwaInstaller />
              </ResponsiveFrame>
            </CartProvider>
          </AuthProvider>
        </I18nProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
