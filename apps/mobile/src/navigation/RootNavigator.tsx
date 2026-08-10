import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useAuth } from '../auth/AuthContext';
import { LoginScreen } from '../screens/auth/LoginScreen';
import { RegisterScreen } from '../screens/auth/RegisterScreen';
import { VenueListScreen } from '../screens/venues/VenueListScreen';
import { VenueDetailScreen } from '../screens/venues/VenueDetailScreen';
import { CourtSlotsScreen } from '../screens/venues/CourtSlotsScreen';
import { BookingConfirmScreen } from '../screens/venues/BookingConfirmScreen';
import { MyBookingsScreen } from '../screens/bookings/MyBookingsScreen';
import { AccountScreen } from '../screens/AccountScreen';
import type { AuthStackParamList, RootTabParamList, VenuesStackParamList } from './types';

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const RootTab = createBottomTabNavigator<RootTabParamList>();
const VenuesStack = createNativeStackNavigator<VenuesStackParamList>();

function AuthNavigator() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="Login" component={LoginScreen} />
      <AuthStack.Screen name="Register" component={RegisterScreen} />
    </AuthStack.Navigator>
  );
}

function VenuesNavigator() {
  return (
    <VenuesStack.Navigator>
      <VenuesStack.Screen name="VenueList" component={VenueListScreen} options={{ title: 'Tìm sân' }} />
      <VenuesStack.Screen
        name="VenueDetail"
        component={VenueDetailScreen}
        options={({ route }) => ({ title: route.params.venueName })}
      />
      <VenuesStack.Screen
        name="CourtSlots"
        component={CourtSlotsScreen}
        options={({ route }) => ({ title: route.params.courtName })}
      />
      <VenuesStack.Screen
        name="BookingConfirm"
        component={BookingConfirmScreen}
        options={{ title: 'Xác nhận đặt sân' }}
      />
    </VenuesStack.Navigator>
  );
}

function AppTabs() {
  return (
    <RootTab.Navigator>
      <RootTab.Screen name="Venues" component={VenuesNavigator} options={{ headerShown: false, title: 'Tìm sân' }} />
      <RootTab.Screen name="MyBookings" component={MyBookingsScreen} options={{ title: 'Lịch của tôi' }} />
      <RootTab.Screen name="Account" component={AccountScreen} options={{ title: 'Tài khoản' }} />
    </RootTab.Navigator>
  );
}

export function RootNavigator() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View testID="root-loading" style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }

  return <NavigationContainer>{user ? <AppTabs /> : <AuthNavigator />}</NavigationContainer>;
}
