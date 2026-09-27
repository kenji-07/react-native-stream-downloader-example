import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';

export type TabKey = 'home' | 'downloads' | 'settings';

/**
 * Online playback streams the catalog title. Offline playback is addressed by
 * the downloaded asset's ID; the player resolves its pathToFile with
 * getDownloadedAsset() right before playing.
 */
export type PlayerParams = { mode: 'online'; titleId: string } | { mode: 'offline'; assetId: string };

export type RootStackParamList = {
  Main: { tab?: TabKey } | undefined;
  Title: { titleId: string };
  Player: PlayerParams;
};

export type ScreenProps<RouteName extends keyof RootStackParamList> = NativeStackScreenProps<
  RootStackParamList,
  RouteName
>;

export type RootNavigation = NativeStackNavigationProp<RootStackParamList>;
