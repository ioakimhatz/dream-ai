import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React, { useEffect } from 'react';
import { Platform, StatusBar as RNStatusBar } from 'react-native';
import { useAuth } from '../contexts/AuthContext';

export default function TabLayout() {
  const { user, isLoading } = useAuth();

  // Fix StatusBar on Android when tabs mount
  useEffect(() => {
    if (Platform.OS === 'android') {
      // This fixes the white bars issue on initial load
      RNStatusBar.setBackgroundColor('transparent');
      RNStatusBar.setTranslucent(true);
    }
  }, []);

  // Show nothing while checking auth status
  if (isLoading) {
    return null;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#ffffff',
          borderTopWidth: 1,
          borderTopColor: '#E5E7EB',
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          ...Platform.select({
            ios: {
              shadowColor: '#000',
              shadowOffset: { width: 0, height: -2 },
              shadowOpacity: 0.1,
              shadowRadius: 4,
            },
            android: {
              elevation: 8,
            },
          }),
          height: Platform.OS === 'android' ? 56 : 83,
          paddingBottom: Platform.OS === 'android' ? 8 : 0,
          paddingTop: Platform.OS === 'android' ? 4 : 0,
        },
        tabBarActiveTintColor: '#7278E6',
        tabBarInactiveTintColor: '#9E9E9E',
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: Platform.OS === 'ios' ? '600' : 'bold',
          fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif-medium',
          marginTop: Platform.OS === 'android' ? -2 : 0,
          marginBottom: Platform.OS === 'android' ? 4 : 0,
        },
        tabBarIconStyle: {
          marginTop: Platform.OS === 'android' ? 2 : 5,
        },
        // Prevent lazy loading to avoid white flash
        lazy: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => (
            <Ionicons 
              size={Platform.OS === 'android' ? 24 : 26} 
              name="home-outline" 
              color={color} 
            />
          ),
        }}
      />
      <Tabs.Screen
        name="library"
        options={{
          title: 'Your Dreams',
          headerShown: false,
          tabBarIcon: ({ color }) => (
            <Ionicons 
              size={Platform.OS === 'android' ? 24 : 26} 
              name="moon" 
              color={color} 
            />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          headerShown: false,
          tabBarIcon: ({ color }) => (
            <Ionicons 
              size={Platform.OS === 'android' ? 24 : 26} 
              name="settings-outline" 
              color={color} 
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          href: null,
          title: 'Profile',
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="privacy-policy"
        options={{
          href: null,
          title: 'Privacy Policy',
          headerShown: false,
        }}
      />
    </Tabs>
  );
}