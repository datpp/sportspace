import { useCallback, useEffect, useState } from 'react';
import * as Location from 'expo-location';
import type { Coordinates } from '../utils/distance';

export type LocationState =
  | { status: 'loading' }
  | { status: 'granted'; coords: Coordinates }
  | { status: 'denied' }
  | { status: 'error'; message: string };

export function useCurrentLocation(): LocationState & { retry: () => Promise<void> } {
  const [state, setState] = useState<LocationState>({ status: 'loading' });

  const request = useCallback(async () => {
    setState({ status: 'loading' });
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setState({ status: 'denied' });
        return;
      }
      const position = await Location.getCurrentPositionAsync({});
      setState({
        status: 'granted',
        coords: { lat: position.coords.latitude, lng: position.coords.longitude },
      });
    } catch (err) {
      setState({
        status: 'error',
        message: err instanceof Error ? err.message : 'Không lấy được vị trí hiện tại',
      });
    }
  }, []);

  useEffect(() => {
    void request();
  }, [request]);

  return { ...state, retry: request };
}
