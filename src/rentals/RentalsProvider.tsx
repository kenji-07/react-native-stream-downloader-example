import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { readJson, writeJson } from '../storage';

export interface Rental {
  rentedAt: number;
  /** Epoch ms. Streaming stops and the downloaded copy expires at this moment. */
  endsAt: number;
}

interface RentalsContextValue {
  /** A clock that ticks every 30 s, so rental and expiry labels stay current. */
  now: number;
  /** The rental for a title while it is still active. */
  activeRental: (titleId: string) => Rental | undefined;
  rent: (titleId: string, hours: number) => Rental;
}

const KEY = 'rentals.v1';
const HOUR = 60 * 60 * 1000;

function loadRentals(): Record<string, Rental> {
  const stored = readJson(KEY);
  const rentals: Record<string, Rental> = {};
  if (stored === null || typeof stored !== 'object' || Array.isArray(stored)) return rentals;
  for (const [titleId, value] of Object.entries(stored)) {
    if (value !== null && typeof value === 'object') {
      const rentedAt: unknown = Reflect.get(value, 'rentedAt');
      const endsAt: unknown = Reflect.get(value, 'endsAt');
      if (typeof rentedAt === 'number' && typeof endsAt === 'number') rentals[titleId] = { rentedAt, endsAt };
    }
  }
  return rentals;
}

const RentalsContext = createContext<RentalsContextValue | null>(null);

/**
 * Demo rentals: renting is local and free (no payment is taken). A rental
 * limits streaming and becomes the downloaded copy's expiresAt.
 */
export function RentalsProvider({ children }: { children: ReactNode }) {
  const [rentals, setRentals] = useState<Record<string, Rental>>(loadRentals);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    writeJson(KEY, rentals);
  }, [rentals]);

  const activeRental = useCallback(
    (titleId: string) => {
      const rental = rentals[titleId];
      return rental !== undefined && rental.endsAt > now ? rental : undefined;
    },
    [now, rentals],
  );

  const rent = useCallback((titleId: string, hours: number) => {
    const rentedAt = Date.now();
    const rental = { rentedAt, endsAt: rentedAt + hours * HOUR };
    setRentals(previous => ({ ...previous, [titleId]: rental }));
    setNow(rentedAt);
    return rental;
  }, []);

  const value = useMemo(() => ({ now, activeRental, rent }), [now, activeRental, rent]);
  return <RentalsContext.Provider value={value}>{children}</RentalsContext.Provider>;
}

export function useRentals(): RentalsContextValue {
  const context = useContext(RentalsContext);
  if (context === null) throw new Error('useRentals must be used inside <RentalsProvider>.');
  return context;
}
