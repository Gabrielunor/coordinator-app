/**
 * Custom hook for managing location services and GPS coordinates
 */

import { useState, useEffect, useCallback } from 'react';
import * as Location from 'expo-location';
import { GPSCoordinates } from '@/types';

interface UseLocationReturn {
  currentLocation: GPSCoordinates | null;
  isLoading: boolean;
  error: string | null;
  hasPermission: boolean;
  requestPermission: () => Promise<boolean>;
  getCurrentLocation: () => Promise<void>;
  startWatching: () => void;
  stopWatching: () => void;
  isWatching: boolean;
}

export function useLocation(): UseLocationReturn {
  const [currentLocation, setCurrentLocation] = useState<GPSCoordinates | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasPermission, setHasPermission] = useState(false);
  const [watchSubscription, setWatchSubscription] = useState<Location.LocationSubscription | null>(null);

  // Check permission on mount
  useEffect(() => {
    checkPermission();
  }, []);

  const checkPermission = async () => {
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      setHasPermission(status === 'granted');
    } catch (err) {
      console.error('Error checking location permission:', err);
      setError('Error checking location permission');
    }
  };

  const requestPermission = useCallback(async (): Promise<boolean> => {
    try {
      setError(null);
      const { status } = await Location.requestForegroundPermissionsAsync();
      const granted = status === 'granted';
      setHasPermission(granted);
      
      if (!granted) {
        setError('Location permission is required to use this app');
      }
      
      return granted;
    } catch (err) {
      console.error('Error requesting location permission:', err);
      setError('Error requesting location permission');
      return false;
    }
  }, []);

  const getCurrentLocation = useCallback(async () => {
    if (!hasPermission) {
      setError('Location permission not granted');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
        maximumAge: 10000, // 10 seconds
        timeout: 15000, // 15 seconds
      });

      const coordinates: GPSCoordinates = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy || undefined,
        timestamp: location.timestamp,
      };

      setCurrentLocation(coordinates);
    } catch (err) {
      console.error('Error getting current location:', err);
      setError('Unable to get current location. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [hasPermission]);

  const startWatching = useCallback(async () => {
    if (!hasPermission) {
      setError('Location permission not granted');
      return;
    }

    if (watchSubscription) {
      return; // Already watching
    }

    setError(null);

    try {
      const subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 5000, // Update every 5 seconds
          distanceInterval: 1, // Update every 1 meter
        },
        (location) => {
          const coordinates: GPSCoordinates = {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            accuracy: location.coords.accuracy || undefined,
            timestamp: location.timestamp,
          };
          setCurrentLocation(coordinates);
        }
      );

      setWatchSubscription(subscription);
    } catch (err) {
      console.error('Error starting location watch:', err);
      setError('Unable to start location tracking');
    }
  }, [hasPermission, watchSubscription]);

  const stopWatching = useCallback(() => {
    if (watchSubscription) {
      watchSubscription.remove();
      setWatchSubscription(null);
    }
  }, [watchSubscription]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (watchSubscription) {
        watchSubscription.remove();
      }
    };
  }, [watchSubscription]);

  return {
    currentLocation,
    isLoading,
    error,
    hasPermission,
    requestPermission,
    getCurrentLocation,
    startWatching,
    stopWatching,
    isWatching: !!watchSubscription,
  };
}