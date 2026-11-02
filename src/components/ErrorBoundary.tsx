import {HOME_FONT} from './homePresentation';
import React from 'react';
import {Text, TouchableOpacity, ScrollView} from 'react-native';
import useThemeStore from '../lib/zustand/themeStore';
import {useTranslation} from 'react-i18next';

interface ErrorFallbackProps {
  error: Error;
  resetError: () => void;
}

export const ErrorFallback: React.FC<ErrorFallbackProps> = ({
  error,
  resetError,
}) => {
  const {primary} = useThemeStore();
  const {t} = useTranslation();
  return (
    <ScrollView
      className="flex-1 bg-black"
      contentContainerStyle={{
        flexGrow: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
      }}>
      <Text
        style={{fontFamily: HOME_FONT.heading}}
        className="text-red-400 text-lg font-bold mb-4 text-center">
        {t('Something went wrong')}
      </Text>
      <Text
        style={{fontFamily: HOME_FONT.regular}}
        className="text-gray-400 text-sm mb-6 text-center">
        {error.message || t('An unexpected error occurred')}
      </Text>
      <TouchableOpacity
        onPress={resetError}
        className="px-6 py-3"
        style={{backgroundColor: primary}}>
        <Text
          style={{fontFamily: HOME_FONT.regular}}
          className="text-white font-semibold">
          {t('Try Again')}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

interface QueryErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<ErrorFallbackProps>;
}

interface QueryErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class QueryErrorBoundary extends React.Component<
  QueryErrorBoundaryProps,
  QueryErrorBoundaryState
> {
  constructor(props: QueryErrorBoundaryProps) {
    super(props);
    this.state = {hasError: false, error: null};
  }

  static getDerivedStateFromError(error: Error): QueryErrorBoundaryState {
    return {hasError: true, error};
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('QueryErrorBoundary caught an error:', error, errorInfo);
  }

  resetError = () => {
    this.setState({hasError: false, error: null});
  };

  render() {
    if (this.state.hasError && this.state.error) {
      const FallbackComponent = this.props.fallback || ErrorFallback;
      return (
        <FallbackComponent
          error={this.state.error}
          resetError={this.resetError}
        />
      );
    }

    return this.props.children;
  }
}
