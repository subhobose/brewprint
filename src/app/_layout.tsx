import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { RecipeProvider } from '../RecipeContext';
import { COLORS } from '../ui';

export default function RootLayout() {
  return (
    <RecipeProvider>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: COLORS.bg },
          animation: 'slide_from_right',
        }}
      >
        {/* index is the opening pour; it replaces itself with home. */}
        <Stack.Screen name="index" options={{ animation: 'fade' }} />
        <Stack.Screen name="home" options={{ animation: 'fade' }} />
        <Stack.Screen name="curate" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="drink" />
      </Stack>
      <StatusBar style="dark" />
    </RecipeProvider>
  );
}
