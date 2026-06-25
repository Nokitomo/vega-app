import {create} from 'zustand';
import type {
  OpenWebViewOptions,
  OpenWebViewResult,
} from '../providers/types';

export interface WafRequest extends OpenWebViewOptions {
  id: number;
  url: string;
  resolve: (result: OpenWebViewResult) => void;
  reject: (error: Error) => void;
}

interface WafState {
  requests: WafRequest[];
  enqueue: (request: Omit<WafRequest, 'id'>) => number;
  remove: (id: number) => void;
}

let idCounter = 0;

export const useWafStore = create<WafState>(set => ({
  requests: [],
  enqueue: request => {
    const id = ++idCounter;
    set(state => ({requests: [...state.requests, {...request, id}]}));
    return id;
  },
  remove: id =>
    set(state => ({requests: state.requests.filter(item => item.id !== id)})),
}));
