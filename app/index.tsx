import { Redirect } from 'expo-router';

export default function Index() {
  // Redirect to the converter tab as the default screen
  return <Redirect href="/converter" />;
}

// No styles needed - just redirect to converter
