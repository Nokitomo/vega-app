import React, {useCallback, useEffect, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {MaterialCommunityIcons} from '@expo/vector-icons';
import {useTranslation} from 'react-i18next';
import type {ProviderExtension} from '../../../lib/storage/extensionStorage';
import type {SettingsField} from '../../../lib/providers/types';
import {providerManager} from '../../../lib/services/ProviderManager';
import {createProviderKvStore} from '../../../lib/providers/providerKvStore';
import useThemeStore from '../../../lib/zustand/themeStore';

interface Props {
  visible: boolean;
  provider: ProviderExtension | null;
  onClose: () => void;
}

const defaultsFor = (fields: SettingsField[]) =>
  fields.reduce<Record<string, unknown>>((values, field) => {
    if (field.defaultValue !== undefined) {
      values[field.key] = field.defaultValue;
    }
    return values;
  }, {});

const ProviderSettingsModal = ({visible, provider, onClose}: Props) => {
  const {t} = useTranslation();
  const {primary} = useThemeStore(state => state);
  const [fields, setFields] = useState<SettingsField[]>([]);
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [revealedFields, setRevealedFields] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    if (!provider) {
      return;
    }
    setLoading(true);
    setError('');
    try {
      const schema = await providerManager.getSettingsSchema({
        providerValue: provider.value,
        sourceAuthor: provider.source?.author,
      });
      setFields(schema);
      const store = createProviderKvStore(
        provider.value,
        provider.source?.author,
      );
      const initial = defaultsFor(schema);
      await Promise.all(
        schema.map(async field => {
          const stored = await store.get(field.key);
          if (stored !== undefined) {
            initial[field.key] = stored;
          }
        }),
      );
      setValues(initial);
    } catch (loadError) {
      console.error('Failed to load provider settings:', loadError);
      setError(t('Unable to load provider settings.'));
    } finally {
      setLoading(false);
    }
  }, [provider, t]);

  useEffect(() => {
    if (visible && provider) {
      void load();
    } else {
      setFields([]);
      setValues({});
      setError('');
      setRevealedFields(new Set());
    }
  }, [visible, provider, load]);

  const updateValue = (key: string, value: unknown) => {
    setValues(current => ({...current, [key]: value}));
  };

  const handleSave = async () => {
    if (!provider) {
      return;
    }
    setSaving(true);
    try {
      const store = createProviderKvStore(
        provider.value,
        provider.source?.author,
      );
      await Promise.all(
        fields.map(field => {
          const value = values[field.key];
          return value === undefined || value === null || value === ''
            ? store.delete(field.key)
            : store.set(field.key, value);
        }),
      );
      onClose();
    } catch (saveError) {
      console.error('Failed to save provider settings:', saveError);
      Alert.alert(t('Error'), t('Unable to save provider settings.'));
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (!provider) {
      return;
    }
    Alert.alert(
      t('Reset provider settings'),
      t('Reset all settings for {{provider}} to their defaults?', {
        provider: provider.display_name,
      }),
      [
        {text: t('Cancel'), style: 'cancel'},
        {
          text: t('Reset'),
          style: 'destructive',
          onPress: async () => {
            await providerManager.clearProviderStorage(
              provider.value,
              provider.source?.author,
            );
            setValues(defaultsFor(fields));
          },
        },
      ],
    );
  };

  const renderField = (field: SettingsField) => {
    const value = values[field.key];
    const fieldContainer = 'bg-quaternary border border-gray-700 rounded-xl p-4';

    if (field.type === 'toggle') {
      return (
        <View key={field.key} className={`${fieldContainer} flex-row gap-4`}>
          <View className="flex-1">
            <Text className="text-white text-base font-semibold">
              {field.label}
            </Text>
            {field.description ? (
              <Text className="text-gray-400 text-sm mt-1">
                {field.description}
              </Text>
            ) : null}
          </View>
          <Switch
            value={Boolean(value)}
            onValueChange={next => updateValue(field.key, next)}
            trackColor={{false: '#4b5563', true: primary}}
          />
        </View>
      );
    }

    if (field.type === 'select' || field.type === 'multiselect') {
      const selected = Array.isArray(value) ? value : [];
      return (
        <View key={field.key} className={fieldContainer}>
          <Text className="text-white text-base font-semibold">
            {field.label}
          </Text>
          {field.description ? (
            <Text className="text-gray-400 text-sm mt-1 mb-3">
              {field.description}
            </Text>
          ) : (
            <View className="h-3" />
          )}
          <View className="gap-2">
            {field.options.map(option => {
              const isSelected =
                field.type === 'select'
                  ? value === option.value
                  : selected.includes(option.value);
              return (
                <TouchableOpacity
                  key={option.value}
                  onPress={() => {
                    if (field.type === 'select') {
                      updateValue(field.key, option.value);
                      return;
                    }
                    updateValue(
                      field.key,
                      isSelected
                        ? selected.filter(item => item !== option.value)
                        : [...selected, option.value],
                    );
                  }}
                  className="flex-row items-center rounded-lg px-3 py-2.5"
                  style={{
                    backgroundColor: isSelected ? primary : '#262626',
                  }}>
                  <MaterialCommunityIcons
                    name={
                      field.type === 'select'
                        ? isSelected
                          ? 'radiobox-marked'
                          : 'radiobox-blank'
                        : isSelected
                        ? 'checkbox-marked'
                        : 'checkbox-blank-outline'
                    }
                    size={20}
                    color="white"
                  />
                  <Text className="text-white ml-2 flex-1">{option.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      );
    }

    const isNumber = field.type === 'number';
    const isSecure = field.type === 'text' && Boolean(field.secure);
    const revealed = revealedFields.has(field.key);
    return (
      <View key={field.key} className={fieldContainer}>
        <Text className="text-white text-base font-semibold">{field.label}</Text>
        {field.description ? (
          <Text className="text-gray-400 text-sm mt-1">
            {field.description}
          </Text>
        ) : null}
        <View className="flex-row items-center mt-3 bg-tertiary border border-gray-600 rounded-lg">
          <TextInput
            value={value === undefined ? '' : String(value)}
            onChangeText={text => {
              if (!isNumber) {
                updateValue(field.key, text);
                return;
              }
              const parsed = Number(text);
              updateValue(field.key, text === '' || Number.isNaN(parsed) ? undefined : parsed);
            }}
            placeholder={field.type === 'text' ? field.placeholder : undefined}
            placeholderTextColor="#6b7280"
            keyboardType={isNumber ? 'numeric' : 'default'}
            secureTextEntry={isSecure && !revealed}
            autoCapitalize="none"
            autoCorrect={false}
            className="text-white flex-1 px-3 py-3"
          />
          {isSecure ? (
            <TouchableOpacity
              className="px-3 py-3"
              accessibilityLabel={
                revealed ? t('Hide sensitive value') : t('Show sensitive value')
              }
              onPress={() =>
                setRevealedFields(current => {
                  const next = new Set(current);
                  if (next.has(field.key)) {
                    next.delete(field.key);
                  } else {
                    next.add(field.key);
                  }
                  return next;
                })
              }>
              <MaterialCommunityIcons
                name={revealed ? 'eye-off-outline' : 'eye-outline'}
                size={22}
                color="#d1d5db"
              />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    );
  };

  if (!visible || !provider) {
    return null;
  }

  return (
    <Modal transparent animationType="fade" visible onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1 justify-end bg-black/70">
        <Pressable className="flex-1" onPress={onClose} />
        <View className="bg-tertiary rounded-t-3xl px-5 pt-5 pb-7 max-h-[88%] border-t border-gray-700">
          <View className="flex-row items-center pb-4 border-b border-gray-700">
            <View className="flex-1">
              <Text className="text-white text-xl font-bold">
                {t('{{provider}} settings', {
                  provider: provider.display_name,
                })}
              </Text>
              <Text className="text-gray-400 text-sm mt-1">
                {t('Configure this provider')}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} className="p-2">
              <MaterialCommunityIcons name="close" size={24} color="white" />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View className="items-center py-14">
              <ActivityIndicator size="large" color={primary} />
              <Text className="text-gray-400 mt-3">{t('Loading settings...')}</Text>
            </View>
          ) : error ? (
            <View className="items-center py-12">
              <Text className="text-red-400 text-center">{error}</Text>
              <TouchableOpacity onPress={load} className="mt-4 px-4 py-2 rounded-lg" style={{backgroundColor: primary}}>
                <Text className="text-white font-semibold">{t('Retry')}</Text>
              </TouchableOpacity>
            </View>
          ) : fields.length === 0 ? (
            <Text className="text-gray-400 text-center py-12">
              {t('This provider has no configurable settings.')}
            </Text>
          ) : (
            <ScrollView
              className="mt-4"
              contentContainerStyle={{gap: 12, paddingBottom: 8}}
              keyboardShouldPersistTaps="handled">
              {fields.map(renderField)}
            </ScrollView>
          )}

          <View className="flex-row gap-3 pt-4 border-t border-gray-700 mt-3">
            <TouchableOpacity
              disabled={loading || saving || fields.length === 0}
              onPress={handleReset}
              className="w-12 h-12 rounded-xl bg-quaternary items-center justify-center">
              <MaterialCommunityIcons name="restore" size={22} color="white" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onClose}
              className="flex-1 h-12 rounded-xl bg-quaternary items-center justify-center">
              <Text className="text-white font-semibold">{t('Cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              disabled={loading || saving || fields.length === 0}
              onPress={handleSave}
              className="flex-1 h-12 rounded-xl items-center justify-center"
              style={{
                backgroundColor: primary,
                opacity: loading || saving || fields.length === 0 ? 0.5 : 1,
              }}>
              {saving ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="text-white font-semibold">{t('Save')}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

export default ProviderSettingsModal;
