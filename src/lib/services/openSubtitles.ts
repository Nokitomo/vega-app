import * as Application from 'expo-application';
import type {TextTracks} from 'react-native-video';
import {secureStorage} from '../storage';

const API_BASE_URL = 'https://api.opensubtitles.com/api/v1';
const API_KEY_STORAGE_KEY = 'openSubtitlesApiKey';

export interface OpenSubtitlesResult {
  id: string;
  fileId: number;
  language: TextTracks[number]['language'];
  release: string;
  title: string;
  season?: number;
  episode?: number;
  uploader?: string;
}

interface SearchResponseItem {
  id?: string;
  attributes?: {
    language?: string;
    release?: string;
    feature_details?: {
      title?: string;
      season_number?: number;
      episode_number?: number;
    };
    uploader?: {name?: string};
    files?: Array<{file_id?: number; file_name?: string}>;
  };
}

const getUserAgent = () => {
  const name = Application.applicationName || 'Vega';
  const version = Application.nativeApplicationVersion || 'unknown';
  return `${name} v${version}`;
};

const getHeaders = () => {
  const apiKey = getOpenSubtitlesApiKey();
  if (!apiKey) {
    throw new Error('OPEN_SUBTITLES_API_KEY_REQUIRED');
  }
  return {
    Accept: 'application/json',
    'Api-Key': apiKey,
    'User-Agent': getUserAgent(),
  };
};

const parseError = async (response: Response) => {
  try {
    const payload = await response.json();
    if (typeof payload?.message === 'string') {
      return payload.message;
    }
  } catch {
    // Ignore invalid error bodies and use the HTTP status below.
  }
  return `OpenSubtitles request failed (${response.status})`;
};

export const getOpenSubtitlesApiKey = () =>
  secureStorage.getString(API_KEY_STORAGE_KEY)?.trim() || '';

export const setOpenSubtitlesApiKey = (apiKey: string) => {
  const normalized = apiKey.trim();
  if (normalized) {
    secureStorage.setString(API_KEY_STORAGE_KEY, normalized);
  } else {
    secureStorage.delete(API_KEY_STORAGE_KEY);
  }
};

export const searchOpenSubtitles = async ({
  query,
  language,
  season,
  episode,
}: {
  query: string;
  language: string;
  season?: string;
  episode?: string;
}): Promise<OpenSubtitlesResult[]> => {
  const params = new URLSearchParams({languages: language});
  const imdbMatch = query.trim().match(/^tt(\d+)$/i);
  if (imdbMatch) {
    params.set('imdb_id', imdbMatch[1]);
  } else {
    params.set('query', query.trim());
  }
  if (season) {
    params.set('season_number', season);
  }
  if (episode) {
    params.set('episode_number', episode);
  }

  const response = await fetch(`${API_BASE_URL}/subtitles?${params}`, {
    headers: getHeaders(),
  });
  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  const payload = await response.json();
  const data: SearchResponseItem[] = Array.isArray(payload?.data)
    ? payload.data
    : [];
  return data.flatMap(item => {
    const attributes = item.attributes;
    const file = attributes?.files?.find(candidate => candidate?.file_id);
    if (!file?.file_id) {
      return [];
    }
    return [
      {
        id: item.id || String(file.file_id),
        fileId: file.file_id,
        language: (attributes?.language ||
          language) as TextTracks[number]['language'],
        release: attributes?.release || file.file_name || '',
        title: attributes?.feature_details?.title || query,
        season: attributes?.feature_details?.season_number,
        episode: attributes?.feature_details?.episode_number,
        uploader: attributes?.uploader?.name,
      },
    ];
  });
};

export const getOpenSubtitlesDownloadUrl = async (fileId: number) => {
  const response = await fetch(`${API_BASE_URL}/download`, {
    method: 'POST',
    headers: {...getHeaders(), 'Content-Type': 'application/json'},
    body: JSON.stringify({file_id: fileId, sub_format: 'srt'}),
  });
  if (!response.ok) {
    throw new Error(await parseError(response));
  }
  const payload = await response.json();
  if (
    typeof payload?.link !== 'string' ||
    !payload.link.startsWith('https://')
  ) {
    throw new Error('OpenSubtitles returned an invalid download URL');
  }
  return payload.link;
};
