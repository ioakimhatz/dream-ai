// app/(auth)/_layout.tsx - FIXED WITH WHITE BACKGROUND
import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack 
      screenOptions={{ 
        headerShown: false,
        animation: 'slide_from_right',
        contentStyle: { backgroundColor: '#FFFFFF' },
        navigationBarColor: '#FFFFFF',
        statusBarColor: '#FFFFFF',
      }}
      initialRouteName="welcome"
    >
      <Stack.Screen 
        name="welcome" 
        options={{
          contentStyle: { backgroundColor: '#FFFFFF' }
        }}
      />
      <Stack.Screen 
        name="showcase" 
        options={{
          contentStyle: { backgroundColor: '#FFFFFF' }
        }}
      />
      <Stack.Screen 
        name="onboarding" 
        options={{
          contentStyle: { backgroundColor: '#FFFFFF' }
        }}
      />
      <Stack.Screen 
        name="auth-select" 
        options={{
          contentStyle: { backgroundColor: '#FFFFFF' }
        }}
      />
      <Stack.Screen 
        name="email-entry" 
        options={{
          contentStyle: { backgroundColor: '#FFFFFF' }
        }}
      />
      <Stack.Screen 
        name="verify-otp" 
        options={{
          contentStyle: { backgroundColor: '#FFFFFF' }
        }}
      />
      <Stack.Screen 
        name="signin" 
        options={{
          contentStyle: { backgroundColor: '#FFFFFF' }
        }}
      />
      <Stack.Screen 
        name="signup" 
        options={{
          contentStyle: { backgroundColor: '#FFFFFF' }
        }}
      />
    </Stack>
  );
}