import * as Crypto from 'expo-crypto';
import {secureStorage} from '../storage';

const GRAPHQL_URL = 'https://api.anime-skip.com/graphql';
const CREATE_ACCOUNT_URL = 'https://anime-skip.com/account';
const BASE_CLIENT_ID = 'as1JgiMbW4wKfmTLWXS79iTDQFll76pk';
const SESSION_KEY = 'animeSkip.session.v1';

export type AnimeSkipSession = {
  authToken: string;
  refreshToken: string;
  clientId: string;
  username: string;
  email: string;
  profileUrl?: string;
};

type GraphQLError = {message?: string};

const graphQlRequest = async <T>(
  query: string,
  clientId: string,
  authToken?: string,
): Promise<T> => {
  const response = await fetch(GRAPHQL_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-Client-ID': clientId,
      ...(authToken ? {Authorization: `Bearer ${authToken}`} : {}),
    },
    body: JSON.stringify({query}),
  });
  if (!response.ok) {
    throw new Error(`AnimeSkip HTTP ${response.status}`);
  }
  const payload = (await response.json()) as {
    data?: T;
    errors?: GraphQLError[];
  };
  if (payload.errors?.length || !payload.data) {
    throw new Error(payload.errors?.[0]?.message || 'AnimeSkip response invalid');
  }
  return payload.data;
};

export const getAnimeSkipSession = (): AnimeSkipSession | undefined =>
  secureStorage.getObject<AnimeSkipSession>(SESSION_KEY);

export const logoutAnimeSkip = (): void => secureStorage.delete(SESSION_KEY);

export const loginAnimeSkip = async (
  usernameOrEmail: string,
  password: string,
): Promise<AnimeSkipSession> => {
  const identifier = usernameOrEmail.trim();
  if (!identifier || !password) {
    throw new Error('Missing credentials');
  }

  const passwordHash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.MD5,
    password,
  );
  const loginQuery = `{
    login(usernameEmail: ${JSON.stringify(identifier)}, passwordHash: ${JSON.stringify(passwordHash)}) {
      authToken
      refreshToken
      account { profileUrl username email }
    }
  }`;
  const loginData = await graphQlRequest<{
    login?: {
      authToken?: string;
      refreshToken?: string;
      account?: {profileUrl?: string; username?: string; email?: string};
    };
  }>(loginQuery, BASE_CLIENT_ID);
  const login = loginData.login;
  if (!login?.authToken || !login.refreshToken || !login.account?.username) {
    throw new Error('AnimeSkip login response invalid');
  }

  const clientData = await graphQlRequest<{
    myApiClients?: Array<{id?: string}>;
  }>('{ myApiClients { id } }', BASE_CLIENT_ID, login.authToken);
  const clientId = clientData.myApiClients?.[0]?.id?.trim();
  if (!clientId) {
    throw new Error('No AnimeSkip API client found');
  }

  const session: AnimeSkipSession = {
    authToken: login.authToken,
    refreshToken: login.refreshToken,
    clientId,
    username: login.account.username,
    email: login.account.email || identifier,
    profileUrl: login.account.profileUrl,
  };
  secureStorage.setObject(SESSION_KEY, session);
  return session;
};

export const animeSkipAccountUrl = CREATE_ACCOUNT_URL;
