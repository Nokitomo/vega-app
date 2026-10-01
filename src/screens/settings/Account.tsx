import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import React, {useCallback, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import {useTranslation} from 'react-i18next';
import {SettingsStackParamList} from '../../App';
import {
  animeSkipAccountUrl,
  AnimeSkipSession,
  getAnimeSkipSession,
  loginAnimeSkip,
  logoutAnimeSkip,
} from '../../lib/services/animeSkipAuth';
import useThemeStore from '../../lib/zustand/themeStore';

type Props = NativeStackScreenProps<SettingsStackParamList, 'Account'>;

const Account = ({}: Props): React.JSX.Element => {
  const {t} = useTranslation();
  const {primary} = useThemeStore(state => state);
  const [session, setSession] = useState<AnimeSkipSession>();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  useFocusEffect(
    useCallback(() => {
      setSession(getAnimeSkipSession());
    }, []),
  );

  const handleLogin = useCallback(async () => {
    if (!username.trim() || !password) {
      Alert.alert(t('AnimeSkip'), t('Enter username and password.'));
      return;
    }
    setLoading(true);
    try {
      const nextSession = await loginAnimeSkip(username, password);
      setSession(nextSession);
      setPassword('');
      Alert.alert(t('AnimeSkip'), t('Login successful.'));
    } catch (error) {
      console.warn('AnimeSkip login failed', error);
      Alert.alert(t('AnimeSkip'), t('Login failed. Check your credentials.'));
    } finally {
      setLoading(false);
    }
  }, [password, t, username]);

  const handleLogout = useCallback(() => {
    logoutAnimeSkip();
    setSession(undefined);
    setUsername('');
    setPassword('');
  }, []);

  return (
    <ScrollView
      className="flex-1 bg-black"
      contentContainerStyle={{padding: 20, paddingTop: 28}}>
      <Text className="mb-6 text-2xl font-bold text-white">{t('Account')}</Text>

      <View className="overflow-hidden rounded-xl bg-[#1A1A1A] p-4">
        <View className="mb-4 flex-row items-center">
          <View
            className="mr-3 h-11 w-11 items-center justify-center rounded-full"
            style={{backgroundColor: `${primary}33`}}>
            <MaterialCommunityIcons
              name="account-clock-outline"
              size={26}
              color={primary}
            />
          </View>
          <View className="min-w-0 flex-1">
            <Text className="text-lg font-semibold text-white">
              {t('AnimeSkip')}
            </Text>
            <Text className="text-sm text-white/60">
              {session ? t('Connected') : t('Not connected')}
            </Text>
          </View>
        </View>

        {session ? (
          <>
            <Text className="text-base text-white">{session.username}</Text>
            <Text className="mb-5 text-sm text-white/60">{session.email}</Text>
            <TouchableOpacity
              className="items-center rounded-lg bg-[#2A2A2A] p-3"
              onPress={handleLogout}>
              <Text className="font-semibold text-white">{t('Log out')}</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text className="mb-4 text-sm leading-5 text-white/60">
              {t(
                'Sign in to use AnimeSkip when the public skip databases have no result.',
              )}
            </Text>
            <TextInput
              value={username}
              onChangeText={setUsername}
              editable={!loading}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder={t('Username or email')}
              placeholderTextColor="#777"
              className="mb-3 rounded-lg bg-[#262626] px-4 py-3 text-white"
            />
            <TextInput
              value={password}
              onChangeText={setPassword}
              editable={!loading}
              secureTextEntry
              placeholder={t('Password')}
              placeholderTextColor="#777"
              className="mb-4 rounded-lg bg-[#262626] px-4 py-3 text-white"
            />
            <TouchableOpacity
              className="mb-3 min-h-12 items-center justify-center rounded-lg"
              style={{backgroundColor: primary, opacity: loading ? 0.7 : 1}}
              disabled={loading}
              onPress={handleLogin}>
              {loading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="font-semibold text-white">{t('Log in')}</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              className="items-center rounded-lg bg-[#2A2A2A] p-3"
              disabled={loading}
              onPress={() =>
                Linking.openURL(animeSkipAccountUrl).catch(() =>
                  Alert.alert(t('AnimeSkip'), t('Unable to open account page.')),
                )
              }>
              <Text className="font-semibold text-white">
                {t('Create new account')}
              </Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </ScrollView>
  );
};

export default Account;
