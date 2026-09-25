import axios from 'axios';

type AnimeIds = {
  malId?: number;
  anilistId?: number;
};

type AnimeMeta = {
  name?: string;
  description?: string;
  poster?: string;
  background?: string;
  banner?: string;
  year?: number | string;
  runtime?: string;
  imdbRating?: string;
  genres?: string[];
  cast?: string[];
  trailers?: {source: string}[];
};

const ANILIST_API_URL = 'https://graphql.anilist.co';
const JIKAN_API_URL = 'https://api.jikan.moe/v4/anime';
const REQUEST_TIMEOUT = 10000;
const MAX_CAST = 8;

export const fetchAniListBanner = async (
  anilistId: number,
): Promise<string | undefined> => {
  if (!Number.isFinite(anilistId) || anilistId <= 0) {
    return undefined;
  }
  const response = await axios.post(
    ANILIST_API_URL,
    {
      query: 'query ($id: Int) { Media(id: $id, type: ANIME) { bannerImage } }',
      variables: {id: anilistId},
    },
    {
      timeout: REQUEST_TIMEOUT,
      headers: {'Content-Type': 'application/json'},
    },
  );
  const banner = response.data?.data?.Media?.bannerImage;
  return typeof banner === 'string' && banner.trim() ? banner.trim() : undefined;
};

const cleanText = (value?: string) => {
  if (!value) {
    return undefined;
  }
  return value
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
};

const formatScore = (value?: number) => {
  if (value == null || !Number.isFinite(value)) {
    return undefined;
  }
  return (value / 10).toFixed(1);
};

const formatScoreDirect = (value?: number) => {
  if (value == null || !Number.isFinite(value)) {
    return undefined;
  }
  return value.toFixed(1);
};

const buildTrailer = (site?: string, id?: string) => {
  if (!site || !id) {
    return undefined;
  }
  if (!site.toLowerCase().includes('youtube')) {
    return undefined;
  }
  return [{source: id}];
};

const pickTitle = (titles?: {
  english?: string | null;
  romaji?: string | null;
  native?: string | null;
}) => {
  return titles?.english || titles?.romaji || titles?.native || undefined;
};

const uniqueNames = (items: Array<string | undefined | null>) => {
  const seen = new Set<string>();
  const result: string[] = [];
  items.forEach(item => {
    const trimmed = item?.trim();
    if (!trimmed || seen.has(trimmed)) {
      return;
    }
    seen.add(trimmed);
    result.push(trimmed);
  });
  return result;
};

const buildCastFromAniList = (media: any) => {
  const edges = media?.characters?.edges ?? [];
  const names: Array<string | undefined> = [];
  edges.forEach((edge: any) => {
    const voiceActor = edge?.voiceActors?.[0]?.name?.full;
    const character = edge?.node?.name?.full;
    if (voiceActor) {
      names.push(voiceActor);
    } else if (character) {
      names.push(character);
    }
  });
  return uniqueNames(names).slice(0, MAX_CAST);
};

const buildCastFromJikan = (items: any[]) => {
  if (!Array.isArray(items)) {
    return [];
  }
  const names: Array<string | undefined> = [];
  items.forEach(item => {
    const voiceActors = item?.voice_actors;
    const preferred =
      voiceActors?.find((actor: any) => actor?.language === 'Japanese') ||
      voiceActors?.[0];
    const voiceActorName = preferred?.person?.name;
    const characterName = item?.character?.name;
    if (voiceActorName) {
      names.push(voiceActorName);
    } else if (characterName) {
      names.push(characterName);
    }
  });
  return uniqueNames(names).slice(0, MAX_CAST);
};

export const buildAnimeMetaKey = (ids: AnimeIds) => {
  if (ids.anilistId) {
    return `anilist:${ids.anilistId}`;
  }
  if (ids.malId) {
    return `mal:${ids.malId}`;
  }
  return '';
};

const fetchFromAniList = async (anilistId: number): Promise<AnimeMeta> => {
  const query = `
    query ($id: Int) {
      Media(id: $id, type: ANIME) {
        title { romaji english native }
        description
        coverImage { extraLarge large }
        bannerImage
        startDate { year }
        duration
        averageScore
        genres
        trailer { id site }
        characters(page: 1, perPage: 12, sort: [RELEVANCE]) {
          edges {
            node { name { full } }
            voiceActors(language: JAPANESE, sort: [RELEVANCE]) { name { full } }
          }
        }
      }
    }
  `;

  const response = await axios.post(
    ANILIST_API_URL,
    {query, variables: {id: anilistId}},
    {
      timeout: REQUEST_TIMEOUT,
      headers: {'Content-Type': 'application/json'},
    },
  );

  const media = response.data?.data?.Media;
  if (!media) {
    return {};
  }

  const cast = buildCastFromAniList(media);

  return {
    name: pickTitle(media.title),
    description: cleanText(media.description),
    poster: media.coverImage?.extraLarge || media.coverImage?.large,
    banner: media.bannerImage || undefined,
    background: media.bannerImage || media.coverImage?.extraLarge,
    year: media.startDate?.year,
    runtime: media.duration ? `${media.duration} min` : undefined,
    imdbRating: formatScore(media.averageScore),
    genres: Array.isArray(media.genres) ? media.genres : [],
    cast: cast.length > 0 ? cast : undefined,
    trailers: buildTrailer(media.trailer?.site, media.trailer?.id),
  };
};

const fetchFromJikan = async (malId: number): Promise<AnimeMeta> => {
  const response = await axios.get(`${JIKAN_API_URL}/${malId}`, {
    timeout: REQUEST_TIMEOUT,
  });

  const anime = response.data?.data;
  if (!anime) {
    return {};
  }

  const title =
    anime.title_english || anime.title || anime.title_japanese || undefined;

  const trailerId = anime.trailer?.youtube_id || undefined;

  let cast: string[] = [];
  try {
    const castResponse = await axios.get(
      `${JIKAN_API_URL}/${malId}/characters`,
      {timeout: REQUEST_TIMEOUT},
    );
    cast = buildCastFromJikan(castResponse.data?.data);
  } catch (error) {
    console.error('Jikan cast error:', error);
  }

  return {
    name: title,
    description: cleanText(anime.synopsis),
    poster:
      anime.images?.webp?.large_image_url || anime.images?.jpg?.large_image_url,
    background:
      anime.images?.webp?.large_image_url || anime.images?.jpg?.large_image_url,
    year: anime.year || anime.aired?.from?.slice(0, 4),
    runtime: anime.duration || undefined,
    imdbRating: formatScoreDirect(anime.score),
    genres: Array.isArray(anime.genres)
      ? anime.genres.map((genre: {name?: string}) => genre.name).filter(Boolean)
      : [],
    cast: cast.length > 0 ? cast : undefined,
    trailers: buildTrailer('youtube', trailerId),
  };
};

export const fetchAnimeMetadata = async (ids: AnimeIds): Promise<AnimeMeta> => {
  if (!ids?.anilistId && !ids?.malId) {
    return {};
  }

  if (ids.anilistId) {
    try {
      return await fetchFromAniList(ids.anilistId);
    } catch (error) {
      console.error('AniList metadata error:', error);
    }
  }

  if (ids.malId) {
    try {
      return await fetchFromJikan(ids.malId);
    } catch (error) {
      console.error('Jikan metadata error:', error);
    }
  }

  return {};
};
