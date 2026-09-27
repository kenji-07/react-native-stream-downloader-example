import { useNavigation } from '@react-navigation/native';

import type { CatalogTitle } from '../catalog/titles';
import { useTitleDownload } from '../hooks/useTitleDownload';
import { useRentals } from '../rentals/RentalsProvider';
import { useRentTitle } from '../rentals/useRentTitle';
import type { RootNavigation } from '../types/navigation';
import { Button } from './Buttons';

/**
 * Plays the downloaded copy when there is one (works without a connection),
 * otherwise streams the title online. Rentals must be rented first.
 */
export function PlayButton({ title }: { title: CatalogTitle }) {
  const navigation = useNavigation<RootNavigation>();
  const download = useTitleDownload(title.id);
  const { activeRental } = useRentals();
  const rentTitle = useRentTitle();

  if (title.rental && !activeRental(title.id)) {
    return <Button icon="timer" label={`Rent · ${title.rental.hours} hours`} onPress={() => rentTitle(title)} />;
  }
  if (download.kind === 'downloaded') {
    return (
      <Button
        icon="play"
        label="Play"
        onPress={() => navigation.navigate('Player', { mode: 'offline', assetId: download.assetId })}
      />
    );
  }
  return (
    <Button
      icon={title.source === null ? 'lock' : 'play'}
      label={title.source === null ? 'Unavailable' : 'Play'}
      disabled={title.source === null}
      onPress={() => navigation.navigate('Player', { mode: 'online', titleId: title.id })}
    />
  );
}
