import 'react-native';
import {expect, it} from '@jest/globals';
import React, {act} from 'react';
import {Image, Text} from 'react-native';
import renderer from 'react-test-renderer';
import EpisodeMetadata from '../src/components/EpisodeMetadata';

const renderedText = (component: renderer.ReactTestRenderer) =>
  component.root
    .findAllByType(Text)
    .flatMap(node => node.props.children)
    .filter((value): value is string => typeof value === 'string');

it('renders TMDB episode artwork and localized metadata', async () => {
  let component: renderer.ReactTestRenderer | undefined;

  await act(async () => {
    component = renderer.create(
      <EpisodeMetadata
        title="L'eremita dei rospi"
        label="Episodio 53"
        synopsis="Naruto incontra Jiraiya."
        thumbnail="https://image.tmdb.org/t/p/original/episode-53.jpg"
        accentColor="#ff0000"
      />,
    );
  });

  expect(component?.root.findAllByType(Image)).toHaveLength(1);
  expect(renderedText(component!)).toEqual([
    'Episodio 53',
    "L'eremita dei rospi",
    'Naruto incontra Jiraiya.',
  ]);

  await act(async () => component?.unmount());
});

it('keeps the compact fallback when optional TMDB metadata is missing', async () => {
  let component: renderer.ReactTestRenderer | undefined;

  await act(async () => {
    component = renderer.create(
      <EpisodeMetadata
        title="Episodio 1"
        synopsis="   "
        thumbnail=""
        accentColor="#ff0000"
      />,
    );
  });

  expect(component?.root.findAllByType(Image)).toHaveLength(0);
  expect(renderedText(component!)).toEqual(['Episodio 1']);

  await act(async () => component?.unmount());
});

it('renders filler as a separate high-contrast badge', async () => {
  let component: renderer.ReactTestRenderer | undefined;

  await act(async () => {
    component = renderer.create(
      <EpisodeMetadata
        title="L'Incubo"
        label="Episodio 54"
        fillerLabel="Filler"
        accentColor="#ff0000"
      />,
    );
  });

  expect(renderedText(component!)).toEqual([
    'Filler',
    'Episodio 54',
    "L'Incubo",
  ]);
  const fillerText = component!.root
    .findAllByType(Text)
    .find(node => node.props.children === 'Filler');
  expect(fillerText?.props.className).toContain('text-black');

  await act(async () => component?.unmount());
});
