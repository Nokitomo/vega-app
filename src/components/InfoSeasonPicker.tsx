import React, {useState} from 'react';
import {FlatList, Modal, Text, TouchableOpacity, View} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useTranslation} from 'react-i18next';
import useThemeStore from '../lib/zustand/themeStore';
import {HOME_FONT} from './homePresentation';

type SeasonOption = {seasonValue: string; displayTitle: string};
export default function InfoSeasonPicker<T extends SeasonOption>({items, selected, onSelect}: {
  items: T[];
  selected?: T;
  onSelect: (item: T) => void;
}) {
  const [open, setOpen] = useState(false);
  const insets = useSafeAreaInsets();
  const {t} = useTranslation();
  const {primary} = useThemeStore();
  if (!items.length) {return null;}
  return (
    <>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel={t('Select season')}
        accessibilityState={{expanded: open}} onPress={() => setOpen(true)}
        style={{minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12}}>
        <Text style={{flex: 1, color: 'white', fontFamily: HOME_FONT.bold, fontSize: 18}}>
          {selected?.displayTitle || items[0].displayTitle}
        </Text>
        <Ionicons name="chevron-down" color="white" size={24} />
      </TouchableOpacity>
      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={{flex: 1, backgroundColor: '#000', paddingTop: insets.top, paddingBottom: insets.bottom}}>
          <View style={{paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12}}>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel={t('Close')}
              onPress={() => setOpen(false)} style={{minWidth: 48, minHeight: 56, justifyContent: 'center'}}>
              <Ionicons name="close" size={28} color="white" />
            </TouchableOpacity>
            <Text style={{flex: 1, color: 'white', fontFamily: HOME_FONT.heading, fontSize: 22}}>{t('Select season')}</Text>
          </View>
          <FlatList data={items} keyExtractor={item => item.seasonValue}
            contentContainerStyle={{padding: 16, maxWidth: 840, width: '100%', alignSelf: 'center'}}
            renderItem={({item}) => {
              const active = item.seasonValue === selected?.seasonValue;
              return <TouchableOpacity accessibilityRole="radio" accessibilityState={{selected: active}}
                onPress={() => {onSelect(item); setOpen(false);}}
                style={{minHeight: 64, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', gap: 16,
                  borderBottomWidth: 1, borderBottomColor: '#23252b'}}>
                <Text style={{flex: 1, color: active ? primary : 'white', fontFamily: HOME_FONT.medium, fontSize: 16}}>{item.displayTitle}</Text>
                {active ? <Ionicons name="checkmark" size={24} color={primary} /> : null}
              </TouchableOpacity>;
            }} />
        </View>
      </Modal>
    </>
  );
}
