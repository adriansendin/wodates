import { create } from 'zustand';

interface PreviewState {
  isPreviewMode: boolean;
}

interface PreviewActions {
  enterPreview: () => void;
  exitPreview: () => void;
}

export const usePreviewStore = create<PreviewState & PreviewActions>((set) => ({
  // State
  isPreviewMode: false,

  // Actions
  enterPreview: () => set({ isPreviewMode: true }),
  exitPreview: () => set({ isPreviewMode: false }),
}));
