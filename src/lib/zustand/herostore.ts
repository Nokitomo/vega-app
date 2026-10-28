import {create} from 'zustand';
import {Post} from '../providers/types';

export interface Hero {
  hero: Post;
  providerScope: string;
  setHero: (hero: Hero['hero'], providerScope: string) => void;
}

const useHeroStore = create<Hero>(set => ({
  hero: {title: '', link: '', image: ''},
  providerScope: '',
  setHero: (hero, providerScope) => set({hero, providerScope}),
}));

export default useHeroStore;
