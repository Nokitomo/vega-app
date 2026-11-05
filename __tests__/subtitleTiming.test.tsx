import React, {act} from 'react';
import renderer from 'react-test-renderer';
import {TextInput, TouchableOpacity} from 'react-native';
import {describe, expect, it, jest} from '@jest/globals';
import {
  parseSubtitleDelay,
  subtitleTimingKey,
} from '../src/lib/utils/subtitleTiming';
import SubtitleTimingEditor from '../src/components/SubtitleTimingEditor';
import {useSubtitleTiming} from '../src/lib/hooks/useSubtitleTiming';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, args?: {seconds: string}) => key + (args?.seconds ?? ''),
    i18n: {language: 'it'},
  }),
}));

describe('subtitle timing', () => {
  it('remembers each track within a session and resets on episode change or exit', async () => {
    let state!: ReturnType<typeof useSubtitleTiming>;
    function Harness({
      content,
      track,
    }: {
      content: string;
      track: string | null;
    }) {
      state = useSubtitleTiming(content, track);
      return null;
    }
    let tree!: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<Harness content="ep1" track="one" />);
    });
    await act(async () => state.apply(1500));
    expect(state.delayMs).toBe(1500);
    await act(async () => tree.update(<Harness content="ep1" track="two" />));
    expect(state.delayMs).toBe(0);
    await act(async () => state.apply(-1000));
    await act(async () => tree.update(<Harness content="ep1" track="one" />));
    expect(state.delayMs).toBe(1500);
    await act(async () => tree.update(<Harness content="ep1" track={null} />));
    expect(state.delayMs).toBe(0);
    await act(async () => tree.update(<Harness content="ep1" track="two" />));
    expect(state.delayMs).toBe(-1000);
    await act(async () => tree.update(<Harness content="ep2" track="two" />));
    expect(state.delayMs).toBe(0);
    await act(async () => tree.update(<Harness content="ep1" track="two" />));
    expect(state.delayMs).toBe(0);
    await act(async () => state.apply(2000));
    await act(async () => tree.unmount());
    await act(async () => {
      tree = renderer.create(<Harness content="ep1" track="two" />);
    });
    expect(state.delayMs).toBe(0);
    await act(async () => tree.unmount());
  });
  it('accepts signed Italian decimals and rejects invalid or excessive values', () => {
    expect(parseSubtitleDelay('-1,5')).toBe(-1500);
    expect(parseSubtitleDelay('+0.1')).toBe(100);
    expect(parseSubtitleDelay('0')).toBe(0);
    expect(parseSubtitleDelay('600')).toBe(600000);
    for (const value of [
      '',
      '-',
      '1,2,3',
      'Infinity',
      'NaN',
      '1e2',
      '600.001',
      '-601',
    ]) {
      expect(parseSubtitleDelay(value)).toBeNull();
    }
  });

  it('keeps external identity across reordering and separates embedded streams', () => {
    expect(subtitleTimingKey({uri: 'file:///one.srt', index: 1}, 'a')).toBe(
      subtitleTimingKey({uri: 'file:///one.srt', index: 3}, 'a'),
    );
    expect(subtitleTimingKey({index: 1, language: 'it'}, 'a')).not.toBe(
      subtitleTimingKey({index: 2, language: 'it'}, 'a'),
    );
    expect(subtitleTimingKey({index: 1}, 'a')).not.toBe(
      subtitleTimingKey({index: 1}, 'b'),
    );
    expect(subtitleTimingKey(undefined, 'a')).toBeNull();
  });

  it('edits a draft, applies once, cancels without applying and resets explicitly', async () => {
    const apply = jest.fn();
    const cancel = jest.fn();
    let tree!: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(
        <SubtitleTimingEditor
          value={0}
          accentColor="#ff9900"
          onApply={apply}
          onCancel={cancel}
        />,
      );
    });
    const press = async (label: string) => {
      await act(async () => {
        tree.root
          .findAllByType(TouchableOpacity)
          .find(x => x.props.accessibilityLabel === label)!
          .props.onPress();
      });
    };
    await press('subtitleTimingLater1');
    await press('subtitleTimingEarlier0,1');
    expect(tree.root.findAllByType(TextInput)).toHaveLength(0);
    await press('subtitleTimingEditValue');
    expect(tree.root.findByType(TextInput).props.value).toBe('0.9');
    expect(apply).not.toHaveBeenCalled();
    await press('subtitleTimingApply');
    expect(apply).toHaveBeenLastCalledWith(900);
    await act(async () => {
      tree.root.findByType(TextInput).props.onChangeText('-1,5');
    });
    await press('subtitleTimingCancel');
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(apply).toHaveBeenCalledTimes(1);
    await press('subtitleTimingApply');
    expect(apply).toHaveBeenLastCalledWith(-1500);
    await act(async () => {
      tree.root.findByType(TextInput).props.onChangeText('invalid');
    });
    expect(
      tree.root
        .findAllByType(TouchableOpacity)
        .find(x => x.props.accessibilityLabel === 'subtitleTimingApply')!.props
        .disabled,
    ).toBe(true);
    await press('subtitleTimingReset');
    expect(apply).toHaveBeenLastCalledWith(0);
    await act(async () => {
      tree.unmount();
    });
  });
});
