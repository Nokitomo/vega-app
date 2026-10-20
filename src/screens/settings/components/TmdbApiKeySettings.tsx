import React, {useState} from 'react';
import {Alert, Text, TextInput, TouchableOpacity, View} from 'react-native';
import {useTranslation} from 'react-i18next';
import {getAppTmdbApiKey} from '../../../lib/storage/tmdbApiKeyStorage';
import {saveAppTmdbApiKey} from '../../../lib/services/appTmdbSettings';

const TmdbApiKeySettings = ({primary}: {primary: string}) => {
  const {t} = useTranslation();
  const [keyInput, setKeyInput] = useState('');
  const [configured, setConfigured] = useState(Boolean(getAppTmdbApiKey()));
  const [saved, setSaved] = useState(false);

  const save = () => {
    if (!keyInput.trim()) {
      return;
    }
    try {
      saveAppTmdbApiKey(keyInput);
      setKeyInput('');
      setConfigured(true);
      setSaved(true);
    } catch {
      Alert.alert(t('Error'), t('Unable to save TMDB key.'));
    }
  };

  const remove = () => {
    try {
      saveAppTmdbApiKey('');
      setKeyInput('');
      setConfigured(false);
      setSaved(false);
    } catch {
      Alert.alert(t('Error'), t('Unable to save TMDB key.'));
    }
  };

  return (
    <View className="mb-6">
      <Text className="text-gray-400 text-sm mb-3">{t('Metadata')}</Text>
      <View className="bg-[#1A1A1A] rounded-xl p-4">
        <Text className="text-white text-base font-medium">
          {t('TMDB API key')}
        </Text>
        <Text className="text-gray-400 text-sm mt-1 mb-3">
          {t('Optional. Shared by AnimeUnity, StreamingUnity and StreamCenter when installed.')}
        </Text>
        <TextInput
          value={keyInput}
          onChangeText={value => {
            setKeyInput(value);
            setSaved(false);
          }}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          placeholder={configured ? t('Enter a new key to replace the saved one') : t('Enter TMDB API key v3')}
          placeholderTextColor="#888888"
          accessibilityLabel={t('TMDB API key')}
          className="text-white bg-[#262626] rounded-lg px-3 py-3"
        />
        <Text className="text-gray-400 text-xs mt-2">
          {configured ? t('TMDB key saved') : t('No TMDB key saved')}
        </Text>
        <View className="flex-row gap-3 mt-4">
          <TouchableOpacity
            disabled={!keyInput.trim()}
            onPress={save}
            className="rounded-lg px-4 py-3"
            style={{backgroundColor: primary, opacity: keyInput.trim() ? 1 : 0.5}}>
            <Text className="text-white font-medium">
              {saved ? t('Saved') : t('Save')}
            </Text>
          </TouchableOpacity>
          {configured ? (
            <TouchableOpacity
              onPress={remove}
              className="bg-[#262626] rounded-lg px-4 py-3">
              <Text className="text-white font-medium">{t('Remove')}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    </View>
  );
};

export default TmdbApiKeySettings;
