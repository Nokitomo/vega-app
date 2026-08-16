import React, {memo, useMemo} from 'react';
import {Text, View} from 'react-native';
import {useTranslation} from 'react-i18next';
import type {Post} from '../lib/providers/types';
import {hasItaBadge} from '../lib/utils/helpers';

interface PostBadgesProps {
  post: Post;
  primary: string;
}

const PostBadges = ({post, primary}: PostBadgesProps): React.ReactElement => {
  const {t} = useTranslation();
  const episodeLabel = post.episodeLabelKey
    ? t(post.episodeLabelKey, post.episodeLabelParams)
    : post.episodeLabel;
  const dubLabel = useMemo(() => {
    if (post.dubStatus === 'both') {
      return t('SUB/ITA');
    }
    if (post.dubStatus === 'dubbed' || hasItaBadge(post.title)) {
      return t('ITA');
    }
    if (post.dubStatus === 'subbed') {
      return t('SUB');
    }
    return '';
  }, [post.dubStatus, post.title, t]);
  const rating = String(post.rating || '').trim();

  return (
    <>
      {episodeLabel ? (
        <View
          className="absolute top-1 right-1 rounded-full px-2 py-0.5"
          style={{backgroundColor: primary}}>
          <Text className="text-black text-[10px] font-semibold">
            {episodeLabel}
          </Text>
        </View>
      ) : null}
      {dubLabel ? (
        <View
          className="absolute top-1 left-1 rounded-full px-2 py-0.5"
          style={{backgroundColor: primary}}>
          <Text className="text-black text-[10px] font-semibold">
            {dubLabel}
          </Text>
        </View>
      ) : null}
      {rating ? (
        <View className="absolute bottom-1 right-1 rounded-full bg-black/80 px-2 py-0.5">
          <Text className="text-white text-[10px] font-semibold">
            ★ {rating}
          </Text>
        </View>
      ) : null}
    </>
  );
};

export default memo(PostBadges);
