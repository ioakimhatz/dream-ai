// app/(tabs)/_layout.tsx - WITH AUTH REDIRECT
import { Ionicons } from '@expo/vector-icons';
import { Redirect, Tabs } from 'expo-router';
import React from 'react';

import { HapticTab } from '@/components/HapticTab';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useAuth } from '../contexts/AuthContext';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const { user, isLoading } = useAuth();

  // Show nothing while checking auth status
  if (isLoading) {
    return null;
  }

  // Redirect to signin if not authenticated
  if (!user) {
    return <Redirect href="/(auth)/signin" />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarStyle: {
          backgroundColor: '#ffffff',
          borderTopWidth: 1,
          borderTopColor: '#E5E7EB',
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.1,
          shadowRadius: 4,
          elevation: 8,
          paddingBottom: 0,
          height: 83,
        },
        tabBarActiveTintColor: '#7278E6',       
        tabBarInactiveTintColor: '#9E9E9E',     
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
        },
        tabBarIconStyle: {
          marginTop: 5,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => (
            <Ionicons size={26} name="home-outline" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="library"
        options={{
          title: 'Your Dreams',
          tabBarIcon: ({ color }) => (
            <Ionicons size={26} name="moon" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color }) => (
            <Ionicons size={26} name="settings-outline" color={color} />
          ),
        }}
      />
      
      {/* HIDDEN TABS - Don't show in tab bar */}
      <Tabs.Screen
        name="profile"
        options={{
          href: null, // This hides it from the tab bar
          title: 'Profile',
        }}
      />
      <Tabs.Screen
        name="privacy-policy"
        options={{
          href: null, // This hides it from the tab bar
          title: 'Privacy Policy',
        }}
      />
    </Tabs>
  );
}