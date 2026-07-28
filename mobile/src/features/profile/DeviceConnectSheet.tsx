import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import React, { useState } from 'react';
import { Modal, Pressable, View } from 'react-native';

import {
  useSetSpotifyClientId,
  useSetWhoopCredentials,
  useSpotifyCallback,
  useSpotifyDisconnect,
  useSpotifyStatus,
  useWearableStatus,
  useWhoopCallback,
  useWhoopDisconnect,
} from '@/api/hooks';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { TextField } from '@/components/ui/TextField';
import { buildQueryString, parseQueryParams, pkceCodeChallenge, randomOAuthState, randomPkceVerifier } from '@/lib/oauth';
import { useTheme } from '@/theme/ThemeContext';
import { RADIUS, SPACING } from '@/theme/tokens';

const SPOTIFY_AUTHORIZE_URL = 'https://accounts.spotify.com/authorize';
const SPOTIFY_SCOPES = 'user-read-currently-playing user-read-playback-state user-modify-playback-state';

interface DeviceConnectSheetProps {
  provider: 'whoop' | 'spotify';
  visible: boolean;
  onClose: () => void;
}

// This app has never been linked to a Whoop/Spotify developer account, so
// the *first* time this actually runs end-to-end it needs a real client_id
// (and, for Whoop, a client_secret) from developer.whoop.com or
// developer.spotify.com -- with this exact redirect URI added to that app's
// settings. It's a native deep link (Linking.createURL), so unlike the
// existing web flow it needs no network reachability, but Expo Go's URL
// changes every dev session -- a standalone/dev-client build is what makes
// the registered redirect URI stable enough to actually register.
export function DeviceConnectSheet({ provider, visible, onClose }: DeviceConnectSheetProps) {
  const { colors } = useTheme();
  const isWhoop = provider === 'whoop';

  const wearable = useWearableStatus();
  const spotify = useSpotifyStatus();
  const status = isWhoop ? wearable.data : spotify.data;

  const setWhoopCredentials = useSetWhoopCredentials();
  const whoopCallback = useWhoopCallback();
  const whoopDisconnect = useWhoopDisconnect();
  const setSpotifyClientId = useSetSpotifyClientId();
  const spotifyCallback = useSpotifyCallback();
  const spotifyDisconnect = useSpotifyDisconnect();

  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const redirectUri = Linking.createURL(`${provider}/callback`);
  const label = isWhoop ? 'Whoop' : 'Spotify';

  const saveCredentials = async () => {
    setError(null);
    try {
      if (isWhoop) {
        if (!clientId.trim() || !clientSecret.trim()) return;
        await setWhoopCredentials.mutateAsync({ client_id: clientId.trim(), client_secret: clientSecret.trim() });
      } else {
        if (!clientId.trim()) return;
        await setSpotifyClientId.mutateAsync(clientId.trim());
      }
    } catch {
      setError('Could not save credentials — check your connection and try again.');
    }
  };

  const connect = async () => {
    if (!status?.client_id_configured) return;
    setError(null);
    setConnecting(true);
    try {
      if (isWhoop) {
        const wearableStatus = status as NonNullable<typeof wearable.data>;
        const state = randomOAuthState();
        const authUrl = `${wearableStatus.auth_url}?${buildQueryString({
          client_id: wearableStatus.client_id,
          redirect_uri: redirectUri,
          response_type: 'code',
          scope: wearableStatus.scopes,
          state,
        })}`;
        const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);
        if (result.type !== 'success' || !result.url) return;
        const params = parseQueryParams(result.url);
        if (params.error) {
          setError(`Whoop: ${params.error}`);
          return;
        }
        if (!params.code || params.state !== state) {
          setError('Connection expired — try again.');
          return;
        }
        await whoopCallback.mutateAsync({ code: params.code, redirect_uri: redirectUri, state: params.state });
      } else {
        const spotifyStatus = status as NonNullable<typeof spotify.data>;
        const verifier = randomPkceVerifier();
        const challenge = await pkceCodeChallenge(verifier);
        const authUrl = `${SPOTIFY_AUTHORIZE_URL}?${buildQueryString({
          client_id: spotifyStatus.client_id,
          response_type: 'code',
          redirect_uri: redirectUri,
          code_challenge_method: 'S256',
          code_challenge: challenge,
          scope: SPOTIFY_SCOPES,
        })}`;
        const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);
        if (result.type !== 'success' || !result.url) return;
        const params = parseQueryParams(result.url);
        if (params.error) {
          setError(`Spotify: ${params.error}`);
          return;
        }
        if (!params.code) {
          setError('Connection expired — try again.');
          return;
        }
        await spotifyCallback.mutateAsync({ code: params.code, code_verifier: verifier, redirect_uri: redirectUri });
      }
    } catch {
      setError(`${label} connection failed — the token exchange was rejected. Double-check your credentials and redirect URI.`);
    } finally {
      setConnecting(false);
    }
  };

  const disconnect = () => (isWhoop ? whoopDisconnect.mutate() : spotifyDisconnect.mutate());

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }} onPress={onClose} />
      <View
        style={{
          backgroundColor: colors.card,
          borderTopLeftRadius: RADIUS.sheet,
          borderTopRightRadius: RADIUS.sheet,
          padding: SPACING.lg,
          gap: SPACING.base,
        }}
      >
        <View style={{ alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border }} />
        <Text variant="cardTitle">{status?.connected ? `${label} is connected` : `Connect ${label}`}</Text>

        {!status?.client_id_configured && (
          <View style={{ gap: SPACING.sm }}>
            <Text variant="caption" tone="secondary">
              Create a free app at {isWhoop ? 'developer.whoop.com' : 'developer.spotify.com/dashboard'}, add this exact
              redirect URI to it, then paste the Client ID{isWhoop ? ' and Client Secret' : ''} below.
            </Text>
            <View style={{ backgroundColor: colors.backgroundSecondary, borderRadius: RADIUS.input, padding: SPACING.sm }}>
              <Text variant="caption" selectable>
                {redirectUri}
              </Text>
            </View>
            <TextField placeholder="Client ID" value={clientId} onChangeText={setClientId} autoCapitalize="none" autoCorrect={false} />
            {isWhoop && (
              <TextField
                placeholder="Client Secret"
                value={clientSecret}
                onChangeText={setClientSecret}
                autoCapitalize="none"
                autoCorrect={false}
                secureTextEntry
              />
            )}
            <Button
              label="Save credentials"
              onPress={saveCredentials}
              loading={setWhoopCredentials.isPending || setSpotifyClientId.isPending}
            />
          </View>
        )}

        {status?.client_id_configured && !status.connected && (
          <Button label={`Connect ${label}`} onPress={connect} loading={connecting} />
        )}

        {status?.connected && <Button label={`Disconnect ${label}`} variant="tertiary" onPress={disconnect} />}

        {error && (
          <Text variant="caption" style={{ color: colors.mutedTerracotta }}>
            {error}
          </Text>
        )}
      </View>
    </Modal>
  );
}
