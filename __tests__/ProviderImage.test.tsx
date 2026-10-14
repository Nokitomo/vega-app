import 'react-native';
import {beforeEach, expect, it, jest} from '@jest/globals';
import React, {act} from 'react';
import {Image} from 'react-native';
import renderer from 'react-test-renderer';
import ProviderImage from '../src/components/ProviderImage';
import {
  getCachedProviderPoster,
  resolveProviderPoster,
} from '../src/lib/services/ProviderArtwork';

jest.mock('../src/lib/utils/providerCacheScope', () => ({
  getProviderCacheScope: jest.fn(() => 'test-scope'),
}));
jest.mock('../src/lib/services/ProviderArtwork', () => ({
  getCachedProviderPoster: jest.fn(),
  resolveProviderPoster: jest.fn(),
}));

const getCachedPosterMock = jest.mocked(getCachedProviderPoster);
const resolvePosterMock = jest.mocked(resolveProviderPoster);

const props = {
  uri: 'https://animeunity.example/catalog.jpg',
  link: '/anime/1',
  providerValue: 'animeunity',
};

beforeEach(() => {
  jest.clearAllMocks();
  getCachedPosterMock.mockReturnValue(undefined);
  resolvePosterMock.mockResolvedValue(undefined);
});

it('shows the cached preferred poster immediately and does not remount for the same URL', async () => {
  const preferred = 'https://image.tmdb.org/t/p/w300/poster.jpg';
  getCachedPosterMock.mockReturnValue({
    value: {poster: preferred},
    ageMs: 1000,
    updatedAt: Date.now(),
  });
  resolvePosterMock.mockResolvedValue(preferred);

  let component!: renderer.ReactTestRenderer;
  await act(async () => {
    component = renderer.create(
      <ProviderImage {...props} shouldResolveArtwork={false} />,
    );
  });
  const image = component.root.findByType(Image);
  expect(image.props.source.uri).toBe(preferred);

  await act(async () => {
    component.update(<ProviderImage {...props} shouldResolveArtwork />);
  });
  expect(component.root.findByType(Image)).toBe(image);
  expect(component.root.findByType(Image).props.source.uri).toBe(preferred);
  expect(resolvePosterMock).toHaveBeenCalledTimes(1);

  await act(async () => component.unmount());
});

it('updates the image source without remounting when a preferred poster resolves', async () => {
  const preferred = 'https://image.tmdb.org/t/p/w300/new.jpg';
  resolvePosterMock.mockResolvedValue(preferred);

  let component!: renderer.ReactTestRenderer;
  await act(async () => {
    component = renderer.create(
      <ProviderImage {...props} shouldResolveArtwork={false} />,
    );
  });
  const image = component.root.findByType(Image);
  expect(image.props.source.uri).toContain('placehold.jp');

  await act(async () => {
    component.update(<ProviderImage {...props} shouldResolveArtwork />);
  });
  expect(component.root.findByType(Image)).toBe(image);
  expect(image.props.source.uri).toBe(preferred);

  await act(async () => component.unmount());
});

it('does not show the previous card poster when a list cell is reused', async () => {
  getCachedPosterMock.mockImplementation((_, link) =>
    link === '/anime/1'
      ? {value: {poster: 'https://image.tmdb.org/first.jpg'}, ageMs: 0, updatedAt: 1}
      : {value: {poster: 'https://image.tmdb.org/second.jpg'}, ageMs: 0, updatedAt: 1},
  );

  let component!: renderer.ReactTestRenderer;
  await act(async () => {
    component = renderer.create(
      <ProviderImage {...props} shouldResolveArtwork={false} />,
    );
  });
  const image = component.root.findByType(Image);

  await act(async () => {
    component.update(
      <ProviderImage {...props} link="/anime/2" shouldResolveArtwork={false} />,
    );
  });
  expect(component.root.findByType(Image)).toBe(image);
  expect(image.props.source.uri).toBe('https://image.tmdb.org/second.jpg');

  await act(async () => component.unmount());
});

it('retries the same URL only after an image loading error', async () => {
  const preferred = 'https://image.tmdb.org/t/p/w300/poster.jpg';
  getCachedPosterMock.mockReturnValue({
    value: {poster: preferred},
    ageMs: 0,
    updatedAt: Date.now(),
  });
  resolvePosterMock.mockResolvedValue(preferred);

  let component!: renderer.ReactTestRenderer;
  await act(async () => {
    component = renderer.create(
      <ProviderImage {...props} shouldResolveArtwork={false} />,
    );
  });
  const originalImage = component.root.findByType(Image);
  await act(async () => {
    originalImage.props.onError({nativeEvent: {error: 'network'}});
  });
  const retriedImage = component.root.findByType(Image);
  expect(retriedImage).not.toBe(originalImage);
  expect(retriedImage.props.source.uri).toBe(preferred);
  expect(resolvePosterMock).toHaveBeenCalledWith(
    expect.objectContaining({forceRefresh: true}),
  );

  await act(async () => {
    retriedImage.props.onError({nativeEvent: {error: 'network'}});
  });
  expect(component.root.findByType(Image)).toBe(retriedImage);
  expect(resolvePosterMock).toHaveBeenCalledTimes(1);

  await act(async () => component.unmount());
});

it('keeps the catalog image for other providers', async () => {
  let component!: renderer.ReactTestRenderer;
  await act(async () => {
    component = renderer.create(
      <ProviderImage {...props} providerValue="streamingunity" />,
    );
  });
  expect(component.root.findByType(Image).props.source.uri).toBe(props.uri);
  expect(getCachedPosterMock).not.toHaveBeenCalled();
  expect(resolvePosterMock).not.toHaveBeenCalled();

  await act(async () => component.unmount());
});

it('uses the catalog image after a cached lookup found no preferred poster', async () => {
  getCachedPosterMock.mockReturnValue({
    value: {},
    ageMs: 0,
    updatedAt: Date.now(),
  });
  let component!: renderer.ReactTestRenderer;
  await act(async () => {
    component = renderer.create(
      <ProviderImage {...props} shouldResolveArtwork={false} />,
    );
  });
  expect(component.root.findByType(Image).props.source.uri).toBe(props.uri);

  await act(async () => component.unmount());
});
