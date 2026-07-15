import servicesJson from '@/data/services.json';
import { servicesSchema, type Service } from './schema';

export const services: Service[] = servicesSchema.parse(servicesJson);

export function getServiceById(id: string): Service | undefined {
  return services.find(service => service.id === id);
}
