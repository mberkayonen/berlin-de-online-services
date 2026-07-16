import Fuse from 'fuse.js';
import { services } from './data';

export interface ServiceSearchResult {
  id: string;
  name: string;
  summary: string;
}

const fuse = new Fuse(services, {
  keys: ['name', 'description', 'keywords'],
  threshold: 0.4,
  ignoreLocation: true,
});

export function searchServices(query: string): ServiceSearchResult[] {
  return fuse
    .search(query)
    .slice(0, 5)
    .map(({ item }) => ({
      id: item.id,
      name: item.name,
      summary: item.description,
    }));
}
