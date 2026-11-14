import React from 'react';
import {Text, TouchableOpacity, View} from 'react-native';
import {Feather, Ionicons, MaterialCommunityIcons} from '@expo/vector-icons';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useTranslation} from 'react-i18next';
import type {SettingsStackParamList} from '../../App';
import {catalogStyles} from '../../components/catalog/CatalogViews';
import useThemeStore from '../../lib/zustand/themeStore';

export default function DatabaseSettings({navigation}: NativeStackScreenProps<SettingsStackParamList, 'DatabaseSettings'>) {
  const {t} = useTranslation();
  const primary = useThemeStore(state => state.primary);

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={catalogStyles.page}>
      <View style={{flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12}}>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel={t('Back')}
          onPress={() => navigation.goBack()}
          style={{minWidth: 48, minHeight: 48, justifyContent: 'center'}}>
          <Ionicons name="arrow-back" color="white" size={24} />
        </TouchableOpacity>
        <Text accessibilityRole="header" style={[catalogStyles.title, {marginVertical: 0, flex: 1}]}>
          {t('catalog.title')}
        </Text>
      </View>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel={t('catalog.cinema')}
        onPress={() => navigation.navigate('CatalogSettings')}
        style={{flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 20,
          padding: 16, minHeight: 56, backgroundColor: '#141519'}}>
        <MaterialCommunityIcons name="database-outline" size={22} color={primary} />
        <Text style={[catalogStyles.text, {flex: 1, color: 'white'}]}>{t('catalog.cinema')}</Text>
        <Feather name="chevron-right" size={20} color="gray" />
      </TouchableOpacity>
    </SafeAreaView>
  );
}
