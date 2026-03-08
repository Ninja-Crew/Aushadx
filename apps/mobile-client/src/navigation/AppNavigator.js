import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import LoginScreen from '../screens/LoginScreen';
import DashboardScreen from '../screens/DashboardScreen';
import RemindersScreen from '../screens/RemindersScreen';
import AnalyzerScreen from '../screens/AnalyzerScreen';
import AgentScreen from '../screens/AgentScreen';
import ProfileScreen from '../screens/ProfileScreen';
import AddEditReminderScreen from '../screens/AddEditReminderScreen';
import HomeScreen from '../screens/HomeScreen';
import NearbyHospitalsScreen from '../screens/NearbyHospitalsScreen';
import CustomHeader from '../components/CustomHeader';
import NotificationsScreen from '../screens/NotificationsScreen';
import { useTheme } from '../context/ThemeContext';
import { navigationRef } from './navigationRef';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

const MainTabNavigator = ({ route }) => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const params = route.params || {};

  return (
    <Tab.Navigator
      screenOptions={({ route, navigation }) => ({
        headerShown: true,
        header: () => {
          let title = route.name;
          if (route.name === 'HomeTab') title = 'Home';
          if (route.name === 'DoctorTab') title = 'Nearby Doctors';
          if (route.name === 'ScheduleTab') title = 'Schedule';
          if (route.name === 'AIChatTab') title = 'AI Chat';
          return <CustomHeader title={title} navigation={navigation} token={params.token} />;
        },
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
          height: 60 + Math.max(insets.bottom, 10),
          paddingBottom: Math.max(insets.bottom, 10),
          paddingTop: 8,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarIcon: ({ color }) => {
          let iconName = 'circle';
          if (route.name === 'HomeTab') iconName = 'home';
          else if (route.name === 'DoctorTab') iconName = 'local-hospital';
          else if (route.name === 'ScheduleTab') iconName = 'calendar-today';
          else if (route.name === 'AIChatTab') iconName = 'monitor-heart';
          return <MaterialIcons name={iconName} size={24} color={color} />;
        },
      })}
    >
      <Tab.Screen name="HomeTab" component={HomeScreen} options={{ title: 'Home' }} initialParams={params} />
      <Tab.Screen name="DoctorTab" component={NearbyHospitalsScreen} options={{ title: 'Doctor C...' }} initialParams={params} />
      <Tab.Screen name="ScheduleTab" component={RemindersScreen} options={{ title: 'Schedule' }} initialParams={params} />
      <Tab.Screen name="AIChatTab" component={AgentScreen} options={{ title: 'AIChat' }} initialParams={params} />
    </Tab.Navigator>
  );
};

const AppNavigator = () => {
  const { colors } = useTheme();

  const headerStyle = {
    headerStyle: { backgroundColor: colors.card },
    headerTintColor: colors.text,
    headerTitleStyle: { fontWeight: '700', color: colors.text },
  };

  return (
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator initialRouteName="Login" screenOptions={headerStyle}>
        <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
        <Stack.Screen name="MainTabs" component={MainTabNavigator} options={{ headerShown: false }} />
        <Stack.Screen name="Dashboard" component={DashboardScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Reminders" component={RemindersScreen} />
        <Stack.Screen name="Analyzer" component={AnalyzerScreen} />
        <Stack.Screen name="Agent" component={AgentScreen} />
        <Stack.Screen name="Profile" component={ProfileScreen} />
        <Stack.Screen name="AddEditReminder" component={AddEditReminderScreen} options={{ title: 'Manage Reminder' }} />
        <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ title: 'Notifications' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigator;

