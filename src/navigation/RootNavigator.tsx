import { DarkTheme, NavigationContainer, type Theme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { DownloadEventToasts } from '../downloader/DownloadEventToasts';
import { MainScreen } from '../screens/MainScreen';
import { PlayerScreen } from '../screens/PlayerScreen';
import { TitleScreen } from '../screens/TitleScreen';
import { colors } from '../theme';
import type { RootStackParamList } from '../types/navigation';
import { navigationRef } from './navigationRef';

const Stack = createNativeStackNavigator<RootStackParamList>();

const theme: Theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: colors.accent,
    background: colors.background,
    card: colors.background,
    text: colors.text,
    border: colors.border,
  },
};

export function RootNavigator() {
  return (
    <NavigationContainer ref={navigationRef} theme={theme}>
      <Stack.Navigator
        initialRouteName="Main"
        screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}
      >
        <Stack.Screen name="Main" component={MainScreen} />
        <Stack.Screen name="Title" component={TitleScreen} />
        <Stack.Screen
          name="Player"
          component={PlayerScreen}
          options={{ presentation: 'fullScreenModal', animation: 'fade', contentStyle: { backgroundColor: colors.black } }}
        />
      </Stack.Navigator>
      <DownloadEventToasts />
    </NavigationContainer>
  );
}
