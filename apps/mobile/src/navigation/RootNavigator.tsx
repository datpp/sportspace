import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useAuth } from '../auth/AuthContext';
import { useTheme } from '../theme';
import { LoginScreen } from '../screens/auth/LoginScreen';
import { RegisterScreen } from '../screens/auth/RegisterScreen';
import { ForgotPasswordScreen } from '../screens/auth/ForgotPasswordScreen';
import { VenueListScreen } from '../screens/venues/VenueListScreen';
import { VenueDetailScreen } from '../screens/venues/VenueDetailScreen';
import { CourtSlotsScreen } from '../screens/venues/CourtSlotsScreen';
import { BookingConfirmScreen } from '../screens/venues/BookingConfirmScreen';
import { MyBookingsScreen } from '../screens/bookings/MyBookingsScreen';
import { CreateMatchScreen } from '../screens/bookings/CreateMatchScreen';
import { WriteReviewScreen } from '../screens/bookings/WriteReviewScreen';
import { MatchListScreen } from '../screens/matches/MatchListScreen';
import { MatchDetailScreen } from '../screens/matches/MatchDetailScreen';
import { NotificationsScreen } from '../screens/notifications/NotificationsScreen';
import { AccountScreen } from '../screens/AccountScreen';
import type {
  AuthStackParamList,
  MatchesStackParamList,
  MyBookingsStackParamList,
  RootTabParamList,
  VenuesStackParamList,
} from './types';

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const RootTab = createBottomTabNavigator<RootTabParamList>();
const VenuesStack = createNativeStackNavigator<VenuesStackParamList>();
const MyBookingsStack = createNativeStackNavigator<MyBookingsStackParamList>();
const MatchesStack = createNativeStackNavigator<MatchesStackParamList>();

function AuthNavigator() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="Login" component={LoginScreen} />
      <AuthStack.Screen name="Register" component={RegisterScreen} />
      <AuthStack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
    </AuthStack.Navigator>
  );
}

function VenuesNavigator() {
  const { colors } = useTheme();
  return (
    <VenuesStack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.card },
        headerTintColor: colors.foreground,
        headerTitleStyle: { color: colors.foreground, fontWeight: '700' },
      }}
    >
      <VenuesStack.Screen
        name="VenueList"
        component={VenueListScreen}
        options={{ title: 'Tìm sân', headerShown: false }}
      />
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

function MyBookingsNavigator() {
  const { colors } = useTheme();
  return (
    <MyBookingsStack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.card },
        headerTintColor: colors.foreground,
        headerTitleStyle: { color: colors.foreground, fontWeight: '700' },
      }}
    >
      <MyBookingsStack.Screen
        name="MyBookingsList"
        component={MyBookingsScreen}
        options={{ title: 'Lịch của tôi', headerShown: false }}
      />
      <MyBookingsStack.Screen
        name="CreateMatch"
        component={CreateMatchScreen}
        options={{ title: 'Tạo kèo' }}
      />
      <MyBookingsStack.Screen
        name="WriteReview"
        component={WriteReviewScreen}
        options={{ title: 'Đánh giá sân' }}
      />
    </MyBookingsStack.Navigator>
  );
}

function MatchesNavigator() {
  const { colors } = useTheme();
  return (
    <MatchesStack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.card },
        headerTintColor: colors.foreground,
        headerTitleStyle: { color: colors.foreground, fontWeight: '700' },
      }}
    >
      <MatchesStack.Screen name="MatchList" component={MatchListScreen} options={{ title: 'Tìm kèo' }} />
      <MatchesStack.Screen
        name="MatchDetail"
        component={MatchDetailScreen}
        options={{ title: 'Chi tiết kèo' }}
      />
    </MatchesStack.Navigator>
  );
}

function AppTabs() {
  const { colors } = useTheme();
  return (
    <RootTab.Navigator
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.border },
      }}
    >
      <RootTab.Screen name="Venues" component={VenuesNavigator} options={{ headerShown: false, title: 'Tìm sân' }} />
      <RootTab.Screen
        name="MyBookings"
        component={MyBookingsNavigator}
        options={{ headerShown: false, title: 'Lịch của tôi' }}
      />
      <RootTab.Screen
        name="Matches"
        component={MatchesNavigator}
        options={{ headerShown: false, title: 'Kèo' }}
      />
      <RootTab.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{ title: 'Thông báo' }}
      />
      <RootTab.Screen
        name="Account"
        component={AccountScreen}
        options={{ headerShown: false, title: 'Tài khoản' }}
      />
    </RootTab.Navigator>
  );
}

export function RootNavigator() {
  const { user, isLoading } = useAuth();
  const { colors } = useTheme();

  if (isLoading) {
    return (
      <View
        testID="root-loading"
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.background,
        }}
      >
        <ActivityIndicator />
      </View>
    );
  }

  return <NavigationContainer>{user ? <AppTabs /> : <AuthNavigator />}</NavigationContainer>;
}
