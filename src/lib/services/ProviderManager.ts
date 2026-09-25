import {ToastAndroid} from 'react-native';
import {providerContext} from '../providers/providerContext';
import {
  ArchiveFilters,
  Catalog,
  EpisodeLink,
  Info,
  Post,
} from '../providers/types';
import {extensionManager} from './ExtensionManager';
import i18n from '../../i18n';

export class ProviderManager {
  private readonly moduleExportsCache = new Map<string, any>();

  private getProviderErrorMessage(
    error: unknown,
    fallbackKey: string,
    params: Record<string, string>,
  ): string {
    if (error instanceof Error && error.message) {
      return error.message;
    }

    if (typeof error === 'string' && error.trim()) {
      return error.trim();
    }

    return i18n.t(fallbackKey, params);
  }

  private createExecutionContext() {
    return {
      exports: {},
      require: () => ({}), // Mock require function
      module: {exports: {}},
      console,
      Promise,
      __awaiter: (thisArg: any, _arguments: any, P: any, generator: any) => {
        function adopt(value: any) {
          return value instanceof P
            ? value
            : new P(function (resolve: any) {
                resolve(value);
              });
        }
        return new (P || (P = Promise))(function (resolve: any, reject: any) {
          function fulfilled(value: any) {
            try {
              step(generator.next(value));
            } catch (e) {
              reject(e);
            }
          }
          function rejected(value: any) {
            try {
              step(generator.throw(value));
            } catch (e) {
              reject(e);
            }
          }
          function step(result: any) {
            result.done
              ? resolve(result.value)
              : adopt(result.value).then(fulfilled, rejected);
          }
          step((generator = generator.apply(thisArg, _arguments || [])).next());
        });
      },
      Object,
    };
  }

  private executeModule(moduleCode: string, ...args: any[]): any {
    const cached = this.moduleExportsCache.get(moduleCode);
    if (cached) {
      return cached;
    }
    const context = this.createExecutionContext();

    const executeModule = new Function(
      'context',
      ...Array.from({length: args.length}, (_, i) => `arg${i}`),
      `
      const exports = context.exports;
      const __awaiter = context.__awaiter;
      const Object = context.Object;
      const console = context.console;
      const Promise = context.Promise;
      
      ${moduleCode}
      
      return exports;
      `,
    );
    const moduleExports = executeModule(context, ...args);
    this.moduleExportsCache.set(moduleCode, moduleExports);
    return moduleExports;
  }
  getCatalog = ({providerValue}: {providerValue: string}): Catalog[] => {
    // Use extensionManager which now handles test mode automatically
    const catalogModule =
      extensionManager.getProviderModules(providerValue)?.modules.catalog;
    if (!catalogModule) {
      return [];
    }
    try {
      const moduleExports = this.executeModule(catalogModule);

      // Return the catalog array directly from exports
      return moduleExports.catalog || [];
    } catch (error) {
      console.error('Error loading catalog:', error);
      console.error('Module content:', catalogModule);
      throw new Error(
        i18n.t('Invalid catalog module for provider: {{provider}}', {
          provider: providerValue,
        }),
      );
    }
  };
  getGenres = ({providerValue}: {providerValue: string}): Catalog[] => {
    // Use extensionManager which now handles test mode automatically
    const catalogModule =
      extensionManager.getProviderModules(providerValue)?.modules.catalog;
    if (!catalogModule) {
      return [];
    }
    try {
      const moduleExports = this.executeModule(catalogModule);

      // Return the genres array directly from exports
      return moduleExports.genres || [];
    } catch (error) {
      console.error('Error loading genres:', error);
      console.error('Module content:', catalogModule);
      throw new Error(
        i18n.t('Invalid catalog module for provider: {{provider}}', {
          provider: providerValue,
        }),
      );
    }
  };
  getArchiveFilters = ({
    providerValue,
  }: {
    providerValue: string;
  }): ArchiveFilters => {
    const catalogModule =
      extensionManager.getProviderModules(providerValue)?.modules.catalog;
    if (!catalogModule) {
      return {};
    }
    try {
      const moduleExports = this.executeModule(catalogModule);
      const filters = moduleExports.archiveFilters;
      return filters && typeof filters === 'object' ? filters : {};
    } catch (error) {
      console.error('Error loading archive filters:', error);
      throw new Error(
        i18n.t('Invalid catalog module for provider: {{provider}}', {
          provider: providerValue,
        }),
      );
    }
  };
  getPosts = async ({
    filter,
    page,
    providerValue,
    signal,
  }: {
    filter: string;
    page: number;
    providerValue: string;
    signal: AbortSignal;
  }): Promise<Post[]> => {
    // Use extensionManager which now handles test mode automatically
    const getPostsModule =
      extensionManager.getProviderModules(providerValue)?.modules.posts;
    if (!getPostsModule) {
      throw new Error(
        i18n.t('No posts module found for provider: {{provider}}', {
          provider: providerValue,
        }),
      );
    }
    try {
      const moduleExports = this.executeModule(
        getPostsModule,
        filter,
        page,
        providerValue,
        signal,
        providerContext,
      );

      // Call the getPosts function
      return await moduleExports.getPosts({
        filter,
        page,
        providerValue,
        signal,
        providerContext,
      });
    } catch (error) {
      console.error('Error in posts function:', error);
      throw new Error(
        this.getProviderErrorMessage(
          error,
          'Failed to get posts from provider: {{provider}}',
          {provider: providerValue},
        ),
      );
    }
  };
  getSearchPosts = async ({
    searchQuery,
    page,
    providerValue,
    signal,
  }: {
    searchQuery: string;
    page: number;
    providerValue: string;
    signal: AbortSignal;
  }): Promise<Post[]> => {
    // Use extensionManager which now handles test mode automatically
    const getPostsModule =
      extensionManager.getProviderModules(providerValue)?.modules.posts;
    if (!getPostsModule) {
      throw new Error(
        i18n.t('No posts module found for provider: {{provider}}', {
          provider: providerValue,
        }),
      );
    }
    try {
      const moduleExports = this.executeModule(
        getPostsModule,
        searchQuery,
        page,
        providerValue,
        signal,
        providerContext,
      );

      // Call the getSearchPosts function
      return await moduleExports.getSearchPosts({
        searchQuery,
        page,
        providerValue,
        signal,
        providerContext,
      });
    } catch (error) {
      console.error('Error in search posts function:', error);
      throw new Error(
        this.getProviderErrorMessage(
          error,
          'Failed to search posts from provider: {{provider}}',
          {provider: providerValue},
        ),
      );
    }
  };
  getMetaData = async ({
    link,
    provider,
    purpose = 'full',
  }: {
    link: string;
    provider: string;
    purpose?: 'full' | 'hero';
  }): Promise<Info> => {
    // Use extensionManager which now handles test mode automatically
    const getMetaDataModule =
      extensionManager.getProviderModules(provider)?.modules.meta;
    if (!getMetaDataModule) {
      throw new Error(
        i18n.t('No meta data module found for provider: {{provider}}', {
          provider,
        }),
      );
    }
    try {
      const moduleExports = this.executeModule(
        getMetaDataModule,
        link,
        provider,
        purpose,
        providerContext,
      );

      // Call the getMetaData function
      return await moduleExports.getMeta({
        link,
        provider,
        purpose,
        providerContext,
      });
    } catch (error) {
      console.error('Error in meta data function:', error);
      throw new Error(
        this.getProviderErrorMessage(
          error,
          'Failed to get metadata from provider: {{provider}}',
          {provider},
        ),
      );
    }
  };
  getArtwork = async ({
    link,
    provider,
    fields = ['poster'],
    hints,
    imageSize = 'original',
  }: {
    link: string;
    provider: string;
    fields?: Array<'logo' | 'poster' | 'background'>;
    hints?: Post['artworkHints'];
    imageSize?: 'original' | 'w300' | 'w780';
  }): Promise<{
    logo?: string;
    poster?: string;
    background?: string;
    resolved?: boolean;
  }> => {
    const metaModule =
      extensionManager.getProviderModules(provider)?.modules.meta;
    if (!metaModule) {
      return {};
    }
    try {
      const moduleExports = this.executeModule(
        metaModule,
        link,
        provider,
        providerContext,
      );
      if (typeof moduleExports.getArtwork === 'function') {
        return await moduleExports.getArtwork({
          link,
          fields,
          hints,
          imageSize,
          providerContext,
        });
      }
      return {};
    } catch (error) {
      console.warn('Artwork lookup failed:', error);
      return {};
    }
  };
  getStream = async ({
    link,
    type,
    signal,
    providerValue,
  }: {
    link: string;
    type: string;
    signal: AbortSignal;
    providerValue: string;
  }): Promise<any[]> => {
    // Use extensionManager which now handles test mode automatically
    const getStreamModule =
      extensionManager.getProviderModules(providerValue)?.modules.stream;
    if (!getStreamModule) {
      throw new Error(
        i18n.t('No stream module found for provider: {{provider}}', {
          provider: providerValue,
        }),
      );
    }
    try {
      const moduleExports = this.executeModule(
        getStreamModule,
        link,
        type,
        signal,
        providerContext,
      );

      // Call the getStream function
      return await moduleExports.getStream({
        link,
        type,
        signal,
        providerContext,
      });
    } catch (error) {
      console.error('Error in stream function:', error);
      throw new Error(
        this.getProviderErrorMessage(
          error,
          'Failed to get stream from provider: {{provider}}',
          {provider: providerValue},
        ),
      );
    }
  };
  getEpisodes = async ({
    url,
    providerValue,
  }: {
    url: string;
    providerValue: string;
  }): Promise<EpisodeLink[]> => {
    // Use extensionManager which now handles test mode automatically
    const getEpisodeLinksModule =
      extensionManager.getProviderModules(providerValue)?.modules.episodes;
    if (!getEpisodeLinksModule) {
      throw new Error(
        i18n.t('No episode links module found for provider: {{provider}}', {
          provider: providerValue,
        }),
      );
    }
    try {
      const moduleExports = this.executeModule(
        getEpisodeLinksModule,
        url,
        providerContext,
      );

      // Call the getEpisodes function
      return await moduleExports.getEpisodes({
        url,
        providerContext,
      });
    } catch (error) {
      console.error('Error in episodes function:', error);
      const errorMessage = this.getProviderErrorMessage(
        error,
        'Failed to get episodes from provider: {{provider}}',
        {provider: providerValue},
      );
      ToastAndroid.show(errorMessage, ToastAndroid.LONG);
      throw new Error(errorMessage);
    }
  };
}

export const providerManager = new ProviderManager();
