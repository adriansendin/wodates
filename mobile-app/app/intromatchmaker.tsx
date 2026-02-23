import { Redirect } from 'expo-router';

/**
 * Legacy route: /intromatchmaker redirects to /manifesto.
 * Keeps existing bookmarks/links working.
 */
export default function IntroMatchmaker() {
  return <Redirect href="/manifesto" />;
}
