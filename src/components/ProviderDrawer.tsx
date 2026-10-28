import React from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useTranslation} from 'react-i18next';
import useContentStore from '../lib/zustand/contentStore';
import {ProviderExtension, extensionStorage} from '../lib/storage';
import {HOME_FONT} from './homePresentation';
import {useReducedMotion} from '../lib/hooks/useReducedMotion';

const getProviderKey = (item: ProviderExtension) =>
  `${item.source?.author || 'legacy'}:${item.value}`;

const isSameProvider = (left: ProviderExtension, right: ProviderExtension) => {
  if (left.value !== right.value) {
    return false;
  }

  const leftAuthor = left.source?.author;
  const rightAuthor = right.source?.author;
  return !leftAuthor || !rightAuthor || leftAuthor === rightAuthor;
};

// Retain the component name and stored drawer preferences for compatibility.
const ProviderDrawer = ({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) => {
  const {t} = useTranslation();
  const {provider, setProvider, installedProviders} = useContentStore(
    state => state,
  );
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();

  return (
    <Modal
      visible={visible}
      transparent
      statusBarTranslucent
      animationType={reducedMotion ? 'none' : 'slide'}
      onRequestClose={onClose}>
      <View style={[styles.overlay, {paddingTop: insets.top + 24}]}>
        <Pressable
          testID="provider-sheet-backdrop"
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessible={false}
          importantForAccessibility="no"
        />
        <View
          accessibilityViewIsModal
          style={[styles.sheet, {paddingBottom: Math.max(insets.bottom, 16)}]}>
          <View style={styles.heading}>
            <View style={styles.headingText}>
              <Text accessibilityRole="header" style={styles.title}>
                {t('Select Provider')}
              </Text>
              <Text style={styles.subtitle}>{t('Content source')}</Text>
            </View>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel={t('Close')}
              style={styles.close}>
              <Ionicons name="close" size={24} color="white" />
            </Pressable>
          </View>
          <ScrollView
            style={styles.list}
            contentContainerStyle={styles.listContent}>
            {installedProviders.map(item => {
              const isSelected = isSameProvider(provider, item);
              return (
                <TouchableOpacity
                  activeOpacity={0.7}
                  key={getProviderKey(item)}
                  accessibilityRole="radio"
                  accessibilityState={{checked: isSelected}}
                  accessibilityLabel={item.display_name}
                  onPress={() => {
                    if (item.source?.author) {
                      extensionStorage.setDefaultProviderSource(
                        item.source.author,
                      );
                    }
                    setProvider(item);
                    onClose();
                  }}
                  style={[styles.row, isSelected && styles.selectedRow]}>
                  <Ionicons
                    name="layers-outline"
                    size={22}
                    color={isSelected ? '#FF640A' : '#A0A0A0'}
                  />
                  <Text
                    style={[
                      styles.providerName,
                      isSelected && styles.selectedName,
                    ]}>
                    {item.display_name}
                  </Text>
                  {isSelected && (
                    <Ionicons name="checkmark" size={23} color="#FF640A" />
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  sheet: {
    width: '100%',
    maxWidth: 560,
    maxHeight: '85%',
    backgroundColor: '#141519',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  heading: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#383A40',
  },
  headingText: {flex: 1},
  title: {color: '#FFFFFF', fontSize: 22, fontFamily: HOME_FONT.heading},
  subtitle: {
    color: '#A0A0A0',
    fontSize: 14,
    marginTop: 6,
    fontFamily: HOME_FONT.regular,
  },
  close: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  list: {flexShrink: 1},
  listContent: {padding: 12},
  row: {
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 8,
    marginVertical: 2,
    gap: 14,
  },
  selectedRow: {backgroundColor: '#25262C'},
  providerName: {
    flex: 1,
    color: '#DADADA',
    fontSize: 16,
    fontFamily: HOME_FONT.regular,
  },
  selectedName: {color: '#FFFFFF', fontFamily: HOME_FONT.bold},
});

export default ProviderDrawer;
