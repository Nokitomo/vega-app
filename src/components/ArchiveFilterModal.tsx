import React, {useEffect, useMemo, useState} from 'react';
import {
  Modal,
  ScrollView,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import {Dropdown} from 'react-native-element-dropdown';
import {useTranslation} from 'react-i18next';
import type {
  ArchiveFilterOption,
  ArchiveFilters,
} from '../lib/providers/types';
import {
  ArchiveFilterSelection,
  createEmptyArchiveFilterSelection,
} from '../lib/utils/archiveFilters';

interface ArchiveFilterModalProps {
  visible: boolean;
  filters: ArchiveFilters;
  value: ArchiveFilterSelection;
  primary: string;
  onApply: (selection: ArchiveFilterSelection) => void;
  onClose: () => void;
}

type DropdownItem = {label: string; value: string};

const getOptionValue = (option: ArchiveFilterOption): string =>
  String(option.value ?? option.id ?? option.providerValue ?? '').trim();

const ArchiveFilterModal = ({
  visible,
  filters,
  value,
  primary,
  onApply,
  onClose,
}: ArchiveFilterModalProps): React.ReactElement => {
  const {t} = useTranslation();
  const [draft, setDraft] = useState<ArchiveFilterSelection>(value);

  useEffect(() => {
    if (visible) {
      setDraft({...value, genres: [...value.genres]});
    }
  }, [value, visible]);

  const buildDropdownItems = (key: string): DropdownItem[] => {
    const definition = filters[key];
    if (!Array.isArray(definition)) {
      return [];
    }
    return definition
      .map(option => ({
        label: t(
          option.titleKey || option.title || option.name || getOptionValue(option),
        ),
        value: getOptionValue(option),
      }))
      .filter(item => !!item.value);
  };

  const yearItems = useMemo<DropdownItem[]>(() => {
    const definition = filters.year;
    if (Array.isArray(definition) || !definition?.values) {
      return [];
    }
    return definition.values.map(year => ({
      label: String(year),
      value: String(year),
    }));
  }, [filters.year]);

  const genres = Array.isArray(filters.genres) ? filters.genres : [];
  const toggleGenre = (genre: string) => {
    setDraft(current => ({
      ...current,
      genres: current.genres.includes(genre)
        ? current.genres.filter(item => item !== genre)
        : [...current.genres, genre],
    }));
  };

  const renderDropdown = (
    key: 'order' | 'status' | 'type' | 'season',
    labelKey: string,
  ) => {
    const data = buildDropdownItems(key);
    if (data.length === 0) {
      return null;
    }
    return (
      <View className="mb-4">
        <Text className="text-gray-300 text-sm mb-2">{t(labelKey)}</Text>
        <Dropdown
          data={[{label: t('Any'), value: ''}, ...data]}
          labelField="label"
          valueField="value"
          value={draft[key] || ''}
          placeholder={t('Any')}
          onChange={item =>
            setDraft(current => ({...current, [key]: item.value || undefined}))
          }
          style={{
            backgroundColor: '#262626',
            borderRadius: 8,
            paddingHorizontal: 12,
            minHeight: 44,
          }}
          containerStyle={{backgroundColor: '#262626', borderRadius: 8}}
          selectedTextStyle={{color: 'white', fontSize: 14}}
          placeholderStyle={{color: '#a3a3a3', fontSize: 14}}
          itemTextStyle={{color: 'white', fontSize: 14}}
          itemContainerStyle={{backgroundColor: '#262626'}}
          activeColor="#3A3A3A"
          iconStyle={{tintColor: 'white'}}
        />
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}>
      <View className="flex-1 bg-black/80 justify-end">
        <View className="bg-[#171717] rounded-t-3xl max-h-[90%] px-5 pt-5 pb-8">
          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-white text-xl font-bold">{t('Filters')}</Text>
            <TouchableOpacity onPress={onClose} className="p-2">
              <Ionicons name="close" size={24} color="white" />
            </TouchableOpacity>
          </View>
          <ScrollView showsVerticalScrollIndicator={false}>
            {filters.title ? (
              <View className="mb-4">
                <Text className="text-gray-300 text-sm mb-2">{t('Title')}</Text>
                <TextInput
                  value={draft.title || ''}
                  onChangeText={title =>
                    setDraft(current => ({...current, title: title || undefined}))
                  }
                  placeholder={t('Search by title')}
                  placeholderTextColor="#737373"
                  className="bg-[#262626] text-white rounded-lg px-3 py-3"
                />
              </View>
            ) : null}
            {Array.isArray(filters.year) || yearItems.length === 0 ? null : (
              <View className="mb-4">
                <Text className="text-gray-300 text-sm mb-2">{t('Year')}</Text>
                <Dropdown
                  data={[{label: t('Any'), value: ''}, ...yearItems]}
                  labelField="label"
                  valueField="value"
                  value={draft.year || ''}
                  placeholder={t('Any')}
                  onChange={item =>
                    setDraft(current => ({
                      ...current,
                      year: item.value || undefined,
                    }))
                  }
                  style={{
                    backgroundColor: '#262626',
                    borderRadius: 8,
                    paddingHorizontal: 12,
                    minHeight: 44,
                  }}
                  containerStyle={{backgroundColor: '#262626', borderRadius: 8}}
                  selectedTextStyle={{color: 'white', fontSize: 14}}
                  placeholderStyle={{color: '#a3a3a3', fontSize: 14}}
                  itemTextStyle={{color: 'white', fontSize: 14}}
                  itemContainerStyle={{backgroundColor: '#262626'}}
                  activeColor="#3A3A3A"
                  iconStyle={{tintColor: 'white'}}
                />
              </View>
            )}
            {renderDropdown('order', 'Order')}
            {renderDropdown('status', 'Status')}
            {renderDropdown('type', 'Type')}
            {renderDropdown('season', 'Season')}
            {genres.length > 0 ? (
              <View className="mb-4">
                <Text className="text-gray-300 text-sm mb-2">{t('Genre')}</Text>
                <View className="flex-row flex-wrap gap-2">
                  {genres.map(option => {
                    const genre = getOptionValue(option);
                    const selected = draft.genres.includes(genre);
                    return (
                      <TouchableOpacity
                        key={genre}
                        onPress={() => toggleGenre(genre)}
                        className="rounded-full px-3 py-1.5 border"
                        style={{
                          backgroundColor: selected ? primary : '#262626',
                          borderColor: selected ? primary : '#404040',
                        }}>
                        <Text
                          className={`text-xs ${
                            selected ? 'text-black' : 'text-white'
                          }`}>
                          {t(option.titleKey || option.title || option.name || genre)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            ) : null}
            {filters.dubbed ? (
              <View className="flex-row items-center justify-between py-3 border-t border-white/10">
                <Text className="text-white text-sm">{t('Dubbed')}</Text>
                <Switch
                  value={!!draft.dubbed}
                  onValueChange={dubbed =>
                    setDraft(current => ({...current, dubbed}))
                  }
                  trackColor={{false: '#404040', true: primary}}
                  thumbColor="white"
                />
              </View>
            ) : null}
            {filters.random ? (
              <View className="flex-row items-center justify-between py-3 border-t border-white/10">
                <Text className="text-white text-sm">{t('Random')}</Text>
                <Switch
                  value={!!draft.random}
                  onValueChange={random =>
                    setDraft(current => ({...current, random}))
                  }
                  trackColor={{false: '#404040', true: primary}}
                  thumbColor="white"
                />
              </View>
            ) : null}
          </ScrollView>
          <View className="flex-row gap-3 mt-5">
            <TouchableOpacity
              onPress={() => setDraft(createEmptyArchiveFilterSelection())}
              className="flex-1 bg-[#262626] rounded-lg py-3 items-center">
              <Text className="text-white font-semibold">{t('Reset')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => onApply({...draft, genres: [...draft.genres]})}
              className="flex-1 rounded-lg py-3 items-center"
              style={{backgroundColor: primary}}>
              <Text className="text-black font-semibold">{t('Apply')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default ArchiveFilterModal;
