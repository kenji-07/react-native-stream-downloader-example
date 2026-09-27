import { createNavigationContainerRef } from '@react-navigation/native';

import type { RootStackParamList } from '../types/navigation';

/** Lets app-level UI (e.g. download toasts) navigate from outside a screen. */
export const navigationRef = createNavigationContainerRef<RootStackParamList>();
