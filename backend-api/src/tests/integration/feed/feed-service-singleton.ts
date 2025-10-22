import { FakeFeedService } from './fake-feed-service';

let currentFeedService: FakeFeedService | null = null;

export function setFeedServiceInstance(service: FakeFeedService): void {
  currentFeedService = service;
}

export function getFeedServiceInstance(): FakeFeedService {
  if (!currentFeedService) {
    throw new Error('Feed service instance has not been initialised');
  }

  return currentFeedService;
}

export function clearFeedServiceInstance(): void {
  currentFeedService = null;
}
