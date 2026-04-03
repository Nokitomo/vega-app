export const PASTEBIN_URL = 'https://pastebin.com/raw/KgQ4jTy6';

export type PastebinProviderConfig = {
  match: RegExp;
};

export const PASTEBIN_PROVIDERS: Record<string, PastebinProviderConfig> = {
  animeunity: {
    match: /(?:^|\.)animeunity\./i,
  },
  streamingunity: {
    match: /(?:^|\.)streamingunity\./i,
  },
  guardaserietv: {
    match: /(?:^|\.)guardaserietv\./i,
  },
  altadefinizionez: {
    match: /(?:^|\.)altadefinizione(?:z)?\./i,
  },
};
