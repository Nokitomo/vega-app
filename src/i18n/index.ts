import i18n from 'i18next';
import {initReactI18next} from 'react-i18next';
import {settingsStorage} from '../lib/storage';
import en from './en.json';
import it from './it.json';

export const supportedLanguages = ['en', 'it'] as const;
export type SupportedLanguage = (typeof supportedLanguages)[number];

const fallbackLanguage: SupportedLanguage = 'en';
const storedLanguage = settingsStorage.getAppLanguage();
const initialLanguage: SupportedLanguage =
  storedLanguage === 'it' ? 'it' : fallbackLanguage;

i18n.use(initReactI18next).init({
  resources: {
    en: {translation: en},
    it: {translation: it},
  },
  lng: initialLanguage,
  fallbackLng: fallbackLanguage,
  keySeparator: false,
  nsSeparator: false,
  returnNull: false,
  returnEmptyString: false,
  interpolation: {
    escapeValue: false,
  },
});

export const setAppLanguage = (language: SupportedLanguage) => {
  settingsStorage.setAppLanguage(language);
  i18n.changeLanguage(language);
};

export default i18n;
