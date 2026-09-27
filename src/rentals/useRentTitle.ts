import { Alert } from 'react-native';

import type { Title } from '../catalog/titles';
import { useToast } from '../components/Toast';
import { useRentals } from './RentalsProvider';

/** Confirms and starts a (free, demo) rental. */
export function useRentTitle() {
  const { rent } = useRentals();
  const toast = useToast();

  return (title: Title, onRented?: () => void) => {
    if (!title.rental) return;
    const { hours } = title.rental;
    Alert.alert(
      `Rent “${title.name}”?`,
      `You'll have ${hours} hours to watch, online or downloaded. This is a demo rental — no payment is taken.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: `Rent for ${hours} hours`,
          onPress: () => {
            rent(title.id, hours);
            toast.show({ message: `“${title.name}” is yours for ${hours} hours`, tone: 'success' });
            onRented?.();
          },
        },
      ],
    );
  };
}
