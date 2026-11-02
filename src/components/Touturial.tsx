import {HOME_FONT} from './homePresentation';
import {
  View,
  Text,
  StatusBar,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import React from 'react';
import {useState} from 'react';
import useContentStore from '../lib/zustand/contentStore';
import useThemeStore from '../lib/zustand/themeStore';
import Animated, {FadeInRight} from 'react-native-reanimated';
import {
  NavigationProp,
  useFocusEffect,
  useNavigation,
} from '@react-navigation/native';
import {MaterialCommunityIcons} from '@expo/vector-icons';
import {settingsStorage} from '../lib/storage';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import {RootStackParamList} from '../App';
import {useTranslation} from 'react-i18next';

const Tutorial = () => {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const {primary} = useThemeStore(state => state);
  const {provider: currentProvider, installedProviders} = useContentStore(
    state => state,
  );
  const [showTutorial, setShowTutorial] = useState<boolean>(!currentProvider);

  // Handle default provider setup
  React.useEffect(() => {
    if (
      !currentProvider ||
      !currentProvider.value ||
      !installedProviders ||
      installedProviders.length === 0
    ) {
      setShowTutorial(true);
    } else {
      setShowTutorial(false);
    }
  }, [installedProviders, currentProvider]);

  // Handle status bar color
  useFocusEffect(
    React.useCallback(() => {
      StatusBar.setBackgroundColor('#121212');
      StatusBar.setBarStyle('light-content');

      return () => {
        StatusBar.setBackgroundColor('#121212');
        StatusBar.setBarStyle('light-content');
      };
    }, []),
  );

  const handleGoToExtensions = () => {
    // Add haptic feedback
    if (settingsStorage.isHapticFeedbackEnabled()) {
      ReactNativeHapticFeedback.trigger('effectClick', {
        enableVibrateFallback: true,
        ignoreAndroidSystemSettings: false,
      });
    }

    navigation.navigate('TabStack', {
      screen: 'SettingsStack',
      params: {
        screen: 'Extensions',
      },
    });
  };

  return showTutorial ? (
    <NoProvidersMessage primary={primary} onInstall={handleGoToExtensions} />
  ) : null;
};

export const NoProvidersMessage = ({
  primary,
  onInstall,
}: {
  primary: string;
  onInstall: () => void;
}) => {
  const {t} = useTranslation();
  return (
    <View className="absolute inset-0 z-50 bg-black/90 justify-center items-center w-full h-full">
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: 'center',
          alignItems: 'center',
          padding: 24,
        }}
        style={{width: '100%'}}>
        <Animated.View
          entering={FadeInRight.duration(500)}
          className="p-6 w-full max-w-sm items-center bg-[#141519]">
          <MaterialCommunityIcons
            name="package-variant-closed"
            size={64}
            color="#6B7280"
            style={{marginBottom: 16}}
          />
          <Text
            style={{fontFamily: HOME_FONT.heading}}
            className="text-white text-2xl font-bold text-center mb-4">
            {t('No Provider Installed')}
          </Text>
          <Text
            style={{fontFamily: HOME_FONT.regular}}
            className="text-gray-400 text-base text-center mb-6 leading-6">
            {t(
              'You need to install at least one provider to start watching content. Providers give you access to different streaming sources.',
            )}
          </Text>
          <TouchableOpacity
            onPress={onInstall}
            className="px-6 py-3 min-h-12 w-full flex-row items-center justify-center"
            style={{backgroundColor: primary}}>
            <MaterialCommunityIcons name="download" size={20} color="white" />
            <Text
              style={{fontFamily: HOME_FONT.regular}}
              className="text-white font-semibold ml-2 text-base">
              {t('Install Providers')}
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>
    </View>
  );
};

export default Tutorial;
