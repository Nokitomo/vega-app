import React, {act} from 'react';
import renderer from 'react-test-renderer';
import {afterEach, beforeEach, describe, expect, it, jest} from '@jest/globals';
import {useSearchSuggestions} from '../src/lib/hooks/useSearchSuggestions';
import {fetchTitleSuggestions} from '../src/lib/services/searchSuggestions';
jest.mock('../src/lib/services/searchSuggestions', () => ({fetchTitleSuggestions: jest.fn()}));
const fetchSuggestions = jest.mocked(fetchTitleSuggestions);
let latest: ReturnType<typeof useSearchSuggestions>;
function Probe(props: {query: string; enabled?: boolean; suppressed?: boolean}) {
  latest = useSearchSuggestions(props);
  return null;
}
describe('Suggestion lifecycle', () => {
  beforeEach(() => {jest.useFakeTimers(); jest.clearAllMocks();});
  afterEach(() => {jest.useRealTimers();});
  it('debounces, cancels obsolete responses and never shows suggestions for the previous query', async () => {
    let resolveOld!: (value: any) => void;
    fetchSuggestions.mockImplementationOnce(() => new Promise(resolve => {resolveOld = resolve;}));
    fetchSuggestions.mockResolvedValueOnce([{id: 'new', title: 'New', type: 'tv', source: 'imdb'}]);
    let tree!: renderer.ReactTestRenderer;
    await act(async () => {tree = renderer.create(<Probe query="old" />);});
    expect(latest.status).toBe('loading');
    await act(async () => {jest.advanceTimersByTime(250);});
    const signal = fetchSuggestions.mock.calls[0][1];
    await act(async () => {tree.update(<Probe query="new" />);});
    expect(signal?.aborted).toBe(true);
    await act(async () => {resolveOld([{title: 'Old'}]); jest.advanceTimersByTime(250);});
    expect(latest.suggestions.map(item => item.title)).toEqual(['New']);
    await act(async () => {tree.update(<Probe query="n" />);});
    expect(latest.suggestions).toEqual([]);
    expect(latest.status).toBe('idle');
    expect(fetchSuggestions).toHaveBeenCalledTimes(2);
    await act(async () => {tree.unmount();});
  });
  it('handles rejection and suppresses work when the screen is not active', async () => {
    fetchSuggestions.mockRejectedValue(new Error('network'));
    let tree!: renderer.ReactTestRenderer;
    await act(async () => {tree = renderer.create(<Probe query="test" enabled={false} />); jest.advanceTimersByTime(500);});
    expect(fetchSuggestions).not.toHaveBeenCalled();
    await act(async () => {tree.update(<Probe query="test" />);});
    await act(async () => {jest.advanceTimersByTime(250);});
    expect(latest.status).toBe('error');
    await act(async () => {tree.update(<Probe query="test" suppressed />);});
    expect(latest.status).toBe('idle');
    expect(latest.suggestions).toEqual([]);
    await act(async () => {tree.unmount();});
  });
});
