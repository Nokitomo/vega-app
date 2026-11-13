// Cinema publisher selection rules for season posters and episode thumbnails.
const ROLE = {
  image: 'unknown',
  image_url: 'unknown',
  imageUrl: 'unknown',
  poster: 'poster',
  posters: 'poster',
  background: 'background',
  backdrop: 'background',
  backdrops: 'background',
  logo: 'logo',
  logos: 'logo',
  cover: 'cover',
  cover_mobile: 'cover_mobile',
  thumbnail: 'thumbnail',
  still: 'thumbnail',
  stills: 'thumbnail',
  profile: 'profile',
};
function resolve(value, origins) {
  if (value?.base && value.path) {
    if (!origins[value.base]) {
      throw Error('Unknown image origin');
    }
    return new URL(value.path, origins[value.base]).href;
  }
  if (value && typeof value === 'object') {
    return resolve(value.reference || value.url, origins);
  }
  if (typeof value !== 'string' || !/^https?:\/\//.test(value)) {
    return null;
  }
  const url = new URL(value);
  if (url.username || url.password) {
    throw Error('Credentials in image URL');
  }
  return url.href;
}
const hostSource = url =>
  url &&
  (new URL(url).hostname === 'image.tmdb.org'
    ? 'tmdb'
    : /(^|\.)thetvdb\.com$/.test(new URL(url).hostname)
      ? 'tvdb'
      : null);
const looksLikeImage = value =>
  typeof value === 'string' &&
  /^https?:\/\//.test(value) &&
  (/\.(?:jpg|jpeg|png|webp|svg|gif|avif)(?:[?#]|$)/i.test(value) ||
    /\/(?:images|banners|t\/p)\//.test(value));
function normalizeDetailArtwork(record, origins) {
  const work = 'cinema:' + record.id,
    rows = new Map(),
    policy = record.metadataPolicy || {};
  const externalAllowed = source =>
    !['tmdb', 'tvdb'].includes(source) ||
    (!policy.providerArtworkOnly && !policy.sourceOnly);
  const episodeSourceAllowed = (source, ctx) =>
    !policy.catalog?.excludedMetadataSources?.includes(source) &&
    !(record.warnings || []).some(
      w =>
        w.source === source &&
        String(w.season) === String(ctx.season) &&
        String(w.episode) === String(ctx.episode) &&
        w.reason === 'episode-title-conflict',
    );
  function image(value, ctx) {
    const url = resolve(value, origins);
    if (!url) {
      return;
    }
    if (!ctx.eligible || !['season', 'episode'].includes(ctx.scope)) {
      return;
    }
    const art = url;
    const source = ctx.source || hostSource(url) || 'unknown';
    const episodeAllowed =
      ctx.scope !== 'episode' ||
      !policy.providerEpisodesOnly ||
      !['tmdb', 'tvdb'].includes(source) ||
      ctx.forced;
    const eligible =
      !!ctx.eligible &&
      externalAllowed(source) &&
      episodeAllowed &&
      !ctx.preview &&
      [
        'poster',
        'background',
        'logo',
        'cover',
        'cover_mobile',
        'thumbnail',
        'profile',
      ].includes(ctx.field);
    const payload = {
      source,
      field: ctx.field || 'unknown',
      language: ctx.language ?? null,
      scope: ctx.scope || 'work',
      season: ctx.season ?? null,
      episode: ctx.episode ?? null,
      eligible,
      reason: eligible ? null : ctx.reason || 'retained-only',
      forced: !!ctx.forced,
      preview: !!ctx.preview,
      rank: ctx.rank ?? 0,
      sourcePaths: [ctx.path],
      width: value?.width ?? null,
      height: value?.height ?? null,
    };
    if (!eligible) {
      return;
    }
    const key = JSON.stringify([
      work,
      payload.scope,
      payload.season,
      payload.episode,
      source,
      payload.field,
      payload.language,
      eligible,
      payload.forced,
      payload.preview,
      url,
    ]);
    const previous = rows.get(key);
    if (previous) {
      if (!previous.payload.sourcePaths.includes(ctx.path)) {
        previous.payload.sourcePaths.push(ctx.path);
      }
      previous.payload.rank = Math.min(previous.payload.rank, payload.rank);
      previous.payload.width ??= payload.width;
      previous.payload.height ??= payload.height;
    } else {
      rows.set(key, {id: key, payload, url: art});
    }
  }
  function walk(value, ctx) {
    if (!ctx.eligible || !value) {
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((v, i) =>
        walk(v, {...ctx, path: ctx.path + '/' + i, rank: i}),
      );
      return;
    }
    if (typeof value === 'string') {
      if (ctx.field || looksLikeImage(value)) {
        image(value, {...ctx, field: ctx.field || 'unknown'});
      }
      return;
    }
    if (typeof value !== 'object') {
      return;
    }
    const field = ROLE[value.role || value.type] || ctx.field;
    const declared = value.language ?? value.lang ?? ctx.language;
    const language =
      ctx.source === 'tmdb' && typeof declared === 'string'
        ? declared.split('-')[0]
        : declared;
    const next = {
      ...ctx,
      field,
      language,
      source: value.provider || ctx.source,
    };
    if (value.reference || value.url || value.base) {
      const url = resolve(value, origins);
      if (field || looksLikeImage(url)) {
        image(value, {...next, field: field || 'unknown'});
      }
    }
    for (const [key, child] of Object.entries(value)) {
      if (['reference', 'url', 'base', 'path'].includes(key)) {
        continue;
      }
      if (key === 'previewUrl') {
        image(child, {...next, preview: true, path: ctx.path + '/' + key});
        continue;
      }
      // Only known image fields or inventories are traversed as artwork.
      const slotLanguage =
        next.source === 'tmdb' &&
        /^[a-z]{2}(?:-[A-Za-z]{2})?$/.test(key) &&
        child &&
        typeof child === 'object' &&
        ('status' in child || 'selected' in child || 'candidates' in child)
          ? key.split('-')[0]
          : language;
      walk(child, {
        ...next,
        language: slotLanguage,
        field: ROLE[key] || field || (key === 'images' ? 'unknown' : undefined),
        path: ctx.path + '/' + key,
      });
    }
  }

  for (const [source, library] of Object.entries(record.artworkLibrary || {})) {
    // Keep slot status and all original metadata, separate from selection assignments.

    for (const [number, season] of Object.entries(library.seasons || {})) {
      walk(season, {
        path: 'artworkLibrary/' + source + '/seasons/' + number,
        source,
        scope: 'season',
        season: Number(number),
        eligible: true,
      });
    }
  }
  const episodes = new Map();
  for (const season of record.seasons || []) {
    for (const ep of season.episodes || []) {
      const override = ep.metadataSources?.verifiedOverride;
      const locked = !!override && Object.hasOwn(override, 'thumbnail');
      const canonical = locked ? override.thumbnail : ep.thumbnail;
      const ctx = {
        scope: 'episode',
        season: season.number,
        episode: ep.number,
        field: 'thumbnail',
      };
      episodes.set(season.number + ':' + ep.number, {
        ep,
        ctx,
        locked,
        canonical,
      });
      if (canonical) {
        image(canonical, {
          ...ctx,
          path: 'canonical/' + season.number + '/' + ep.number,
          source:
            hostSource(resolve(canonical, origins)) ||
            Object.keys(ep.metadataSources || {})
              .find(
                k =>
                  resolve(ep.metadataSources[k]?.thumbnail, origins) ===
                  resolve(canonical, origins),
              )
              ?.split(':')[0],
          eligible: true,
          forced: locked,
        });
      }
      if (!locked) {
        for (const [source, data] of Object.entries(ep.metadataSources || {})) {
          if (source === 'verifiedOverride') {
            continue;
          }
          const service = source.split(':')[0];
          const verified =
            episodeSourceAllowed(source, ctx) &&
            (!['tmdb', 'tvdb'].includes(service) ||
              ep.externalMappings?.[service]?.status === 'verified');
          image(data.thumbnail, {
            ...ctx,
            path:
              'metadataSources/' +
              season.number +
              '/' +
              ep.number +
              '/' +
              source,
            source: service,
            eligible: verified,
          });
        }
      }
    }
  }
  const playback = new Map();
  for (const value of episodes.values()) {
    for (const ref of value.ep.playbackSources || []) {
      const key = [ref.provider, ref.titleId, ref.season, ref.episode].join(
        ':',
      );
      if (playback.has(key) && playback.get(key) !== value) {
        throw Error('Ambiguous playback mapping');
      }
      playback.set(key, value);
    }
  }
  for (const [provider, variants] of Object.entries(record.providers || {})) {
    for (const variant of variants) {
      const source = provider + ':' + variant.id;
      for (const season of variant.seasons || []) {
        for (const ep of season.episodes || []) {
          const direct = episodes.get(season.number + ':' + ep.number);
          const mapped =
            playback.get(
              [provider, variant.id, season.number, ep.number].join(':'),
            ) || (!direct?.ep.playbackSources ? direct : null);
          const valid =
            mapped &&
            !mapped.locked &&
            !!mapped.ep.metadataSources?.[source] &&
            episodeSourceAllowed(source, mapped.ctx);
          for (const [i, img] of (ep.images || []).entries()) {
            const field = ROLE[img.role || img.type];
            if (['cover', 'thumbnail'].includes(field)) {
              image(img, {
                ...mapped?.ctx,
                scope: 'episode',
                season: mapped?.ctx.season ?? season.number,
                episode: mapped?.ctx.episode ?? ep.number,
                field: 'thumbnail',
                path:
                  'providerEpisodeImages/' +
                  source +
                  '/' +
                  season.number +
                  '/' +
                  ep.number +
                  '/' +
                  i,
                source: provider,
                language: img.lang ?? null,
                eligible: !!valid,
              });
            }
          }
        }
      }
    }
  }

  return [...rows.values()];
}

export {normalizeDetailArtwork};
