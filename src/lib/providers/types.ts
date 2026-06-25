import {AxiosStatic} from 'axios';
import * as cheerio from 'cheerio';
import {Content} from '../zustand/contentStore';
import * as Crypto from 'expo-crypto';

export type I18nParams = Record<string, string | number>;

export interface ProvidersList {
  name: string;
  value: string;
  type: string;
  flag: string;
}

export interface Post {
  title: string;
  link: string;
  image: string;
  provider?: string;
  day?: string;
  episodeLabel?: string;
  episodeLabelKey?: string;
  episodeLabelParams?: I18nParams;
  episodeId?: string | number;
}

export declare enum TextTrackType {
  SUBRIP = 'application/x-subrip',
  TTML = 'application/ttml+xml',
  VTT = 'text/vtt',
}

export type TextTracks = {
  title: string;
  language: ISO639_1;
  type: TextTrackType;
  uri: string;
}[];

// getStream
export interface Stream {
  server: string;
  link: string;
  type: string;
  quality?: '360' | '480' | '720' | '1080' | '2160';
  subtitles?: TextTracks;
  headers?: any;
}

// getInfo
export interface Info {
  titleKey?: string;
  titleParams?: I18nParams;
  title: string;
  image: string;
  logo?: string;
  background?: string;
  poster?: string;
  synopsis: string;
  imdbId: string;
  year?: string | number;
  runtime?: string;
  country?: string;
  director?: string;
  type: string;
  tags?: string[];
  tagKeys?: Record<string, string>;
  cast?: string[];
  rating?: string;
  genres?: string[];
  studio?: string;
  episodesCount?: number;
  extra?: {
    ids?: {
      malId?: number;
      anilistId?: number;
      crunchyId?: number | string;
      disneyId?: number | string;
      netflixId?: number | string;
      primeId?: number | string;
    };
    stats?: {
      scoreRaw?: string;
      favorites?: number;
      members?: number;
      views?: number;
      episodesCountRaw?: number | string;
      episodesLength?: number | string;
    };
    flags?: {
      dub?: number | boolean;
      alwaysHome?: boolean;
    };
    meta?: {
      day?: string;
      season?: string;
      status?: string;
      type?: string;
      createdAt?: string;
      author?: string;
      userId?: number | string;
    };
  };
  related?: {
    title: string;
    link: string;
    image?: string;
    type?: string;
    year?: string;
  }[];
  linkList: Link[];
}
// getEpisodeLinks
export interface EpisodeLink {
  title: string;
  titleKey?: string;
  titleParams?: I18nParams;
  episodeNumber?: number;
  seasonNumber?: number;
  link: string;
}

export interface Link {
  title: string;
  titleKey?: string;
  titleParams?: I18nParams;
  quality?: string;
  seasonNumber?: number;
  availabilityStatus?: 'upcoming' | 'available';
  availabilityDate?: string;
  availabilityPrecision?: 'day' | 'year' | 'unknown';
  episodesLink?: string;
  directLinks?: {
    title: string;
    titleKey?: string;
    titleParams?: I18nParams;
    episodeNumber?: number;
    seasonNumber?: number;
    link: string;
    type?: 'movie' | 'series';
  }[];
}

// catalog
export interface Catalog {
  title: string;
  titleKey?: string;
  titleParams?: I18nParams;
  filter: string;
  staleTimeMs?: number;
}

export interface ProviderType {
  searchFilter?: string;
  catalog: Catalog[];
  genres: Catalog[];
  blurImage?: boolean;
  nonStreamableServer?: string[];
  nonDownloadableServer?: string[];
  GetStream: ({
    link,
    type,
    signal,
    providerContext,
  }: {
    link: string;
    type: string;
    signal: AbortSignal;
    providerContext: ProviderContext;
  }) => Promise<Stream[]>;
  GetHomePosts: ({
    filter,
    page,
    providerValue,
    signal,
    providerContext,
  }: {
    filter: string;
    page: number;
    providerValue: string;
    signal: AbortSignal;
    providerContext: ProviderContext;
  }) => Promise<Post[]>;
  GetEpisodeLinks?: ({
    url,
    providerContext,
  }: {
    url: string;
    providerContext: ProviderContext;
  }) => Promise<EpisodeLink[]>;
  GetMetaData: ({
    link,
    provider,
    providerContext,
  }: {
    link: string;
    provider: Content['provider'];
    providerContext: ProviderContext;
  }) => Promise<Info>;
  GetSearchPosts: ({
    searchQuery,
    page,
    providerValue,
    signal,
    providerContext,
  }: {
    searchQuery: string;
    page: number;
    providerValue: string;
    signal: AbortSignal;
    providerContext: ProviderContext;
  }) => Promise<Post[]>;
}

export interface OpenWebViewOptions {
  title?: string;
  description?: string;
  headers?: Record<string, string>;
  waitForCookie?: string;
  force?: boolean;
  timeoutMs?: number;
}

export interface OpenWebViewResult {
  data: string;
  cookies: string;
  cookieMap: Record<string, string>;
  userAgent: string;
  url: string;
}

export type ProviderContext = {
  axios: AxiosStatic;
  Crypto: typeof Crypto;
  getBaseUrl: (providerValue: string) => Promise<string>;
  commonHeaders: Record<string, string>;
  cheerio: typeof cheerio;
  extractors: {
    hubcloudExtracter: (link: string, signal: AbortSignal) => Promise<Stream[]>;
    gofileExtracter: (id: string) => Promise<{
      link: string;
      token: string;
    }>;
    superVideoExtractor: (data: any) => Promise<string>;
    gdFlixExtracter: (link: string, signal: AbortSignal) => Promise<Stream[]>;
  };
  openWebView: (
    url: string,
    options?: OpenWebViewOptions,
  ) => Promise<OpenWebViewResult>;
};

export type ISO639_1 =
  | 'aa'
  | 'ab'
  | 'ae'
  | 'af'
  | 'ak'
  | 'am'
  | 'an'
  | 'ar'
  | 'as'
  | 'av'
  | 'ay'
  | 'az'
  | 'ba'
  | 'be'
  | 'bg'
  | 'bi'
  | 'bm'
  | 'bn'
  | 'bo'
  | 'br'
  | 'bs'
  | 'ca'
  | 'ce'
  | 'ch'
  | 'co'
  | 'cr'
  | 'cs'
  | 'cu'
  | 'cv'
  | 'cy'
  | 'da'
  | 'de'
  | 'dv'
  | 'dz'
  | 'ee'
  | 'el'
  | 'en'
  | 'eo'
  | 'es'
  | 'et'
  | 'eu'
  | 'fa'
  | 'ff'
  | 'fi'
  | 'fj'
  | 'fo'
  | 'fr'
  | 'fy'
  | 'ga'
  | 'gd'
  | 'gl'
  | 'gn'
  | 'gu'
  | 'gv'
  | 'ha'
  | 'he'
  | 'hi'
  | 'ho'
  | 'hr'
  | 'ht'
  | 'hu'
  | 'hy'
  | 'hz'
  | 'ia'
  | 'id'
  | 'ie'
  | 'ig'
  | 'ii'
  | 'ik'
  | 'io'
  | 'is'
  | 'it'
  | 'iu'
  | 'ja'
  | 'jv'
  | 'ka'
  | 'kg'
  | 'ki'
  | 'kj'
  | 'kk'
  | 'kl'
  | 'km'
  | 'kn'
  | 'ko'
  | 'kr'
  | 'ks'
  | 'ku'
  | 'kv'
  | 'kw'
  | 'ky'
  | 'la'
  | 'lb'
  | 'lg'
  | 'li'
  | 'ln'
  | 'lo'
  | 'lt'
  | 'lu'
  | 'lv'
  | 'mg'
  | 'mh'
  | 'mi'
  | 'mk'
  | 'ml'
  | 'mn'
  | 'mr'
  | 'ms'
  | 'mt'
  | 'my'
  | 'na'
  | 'nb'
  | 'nd'
  | 'ne'
  | 'ng'
  | 'nl'
  | 'nn'
  | 'no'
  | 'nr'
  | 'nv'
  | 'ny'
  | 'oc'
  | 'oj'
  | 'om'
  | 'or'
  | 'os'
  | 'pa'
  | 'pi'
  | 'pl'
  | 'ps'
  | 'pt'
  | 'qu'
  | 'rm'
  | 'rn'
  | 'ro'
  | 'ru'
  | 'rw'
  | 'sa'
  | 'sc'
  | 'sd'
  | 'se'
  | 'sg'
  | 'si'
  | 'sk'
  | 'sl'
  | 'sm'
  | 'sn'
  | 'so'
  | 'sq'
  | 'sr'
  | 'ss'
  | 'st'
  | 'su'
  | 'sv'
  | 'sw'
  | 'ta'
  | 'te'
  | 'tg'
  | 'th'
  | 'ti'
  | 'tk'
  | 'tl'
  | 'tn'
  | 'to'
  | 'tr'
  | 'ts'
  | 'tt'
  | 'tw'
  | 'ty'
  | 'ug'
  | 'uk'
  | 'ur'
  | 'uz'
  | 've'
  | 'vi'
  | 'vo'
  | 'wa'
  | 'wo'
  | 'xh'
  | 'yi'
  | 'yo'
  | 'za'
  | 'zh'
  | 'zu';
