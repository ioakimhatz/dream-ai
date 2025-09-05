import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="welcome" />
      <Stack.Screen name="showcase" />
      <Stack.Screen name="onboarding" />
      <Stack.Screen name="auth-select" />
      <Stack.Screen name="email-entry" />
      <Stack.Screen name="verify-otp" />
      <Stack.Screen name="signin" />
    </Stack>
  );
}