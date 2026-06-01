import React from 'react';
import { Text } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import type { RootTabParamList } from './types';
import { palette } from './theme';
import {
  EnrollmentScreen,
  AttendanceScreen,
  SyncScreen,
  AdminScreen,
} from '../screens';

const Tab = createBottomTabNavigator<RootTabParamList>();

/** Emoji icons keep us dependency-free (no vector-icon native module) for Phase 1. */
const TAB_ICON: Record<keyof RootTabParamList, string> = {
  Enroll: '🧑‍💼',
  Verify: '✅',
  Sync: '☁️',
  Admin: '⚙️',
};

export function RootNavigator(): React.JSX.Element {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarActiveTintColor: palette.brand,
        tabBarInactiveTintColor: palette.textMuted,
        headerStyle: { backgroundColor: palette.brand },
        headerTintColor: '#FFFFFF',
        headerTitleStyle: { fontWeight: '700' },
        tabBarIcon: ({ size }) => (
          <Text style={{ fontSize: size ? size * 0.9 : 20 }}>
            {TAB_ICON[route.name]}
          </Text>
        ),
      })}>
      <Tab.Screen
        name="Enroll"
        component={EnrollmentScreen}
        options={{ title: 'Enrollment' }}
      />
      <Tab.Screen
        name="Verify"
        component={AttendanceScreen}
        options={{ title: 'Attendance / Verify' }}
      />
      <Tab.Screen
        name="Sync"
        component={SyncScreen}
        options={{ title: 'Sync Dashboard' }}
      />
      <Tab.Screen
        name="Admin"
        component={AdminScreen}
        options={{ title: 'Admin / Settings' }}
      />
    </Tab.Navigator>
  );
}
