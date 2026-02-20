import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';

import LoginScreen from '../screens/LoginScreen';
import DashboardScreen from '../screens/DashboardScreen';
import RemindersScreen from '../screens/RemindersScreen';
import AnalyzerScreen from '../screens/AnalyzerScreen';
import AgentScreen from '../screens/AgentScreen';
import ProfileScreen from '../screens/ProfileScreen';
import AddEditReminderScreen from '../screens/AddEditReminderScreen';

const Stack = createStackNavigator();

import { navigationRef } from './navigationRef';

const AppNavigator = () => {
  return (
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator initialRouteName="Login">
        <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Dashboard" component={DashboardScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Reminders" component={RemindersScreen} />
        <Stack.Screen name="Analyzer" component={AnalyzerScreen} />
        <Stack.Screen name="Agent" component={AgentScreen} />
        <Stack.Screen name="Profile" component={ProfileScreen} />
        <Stack.Screen name="AddEditReminder" component={AddEditReminderScreen} options={{ title: 'Manage Reminder' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigator;
