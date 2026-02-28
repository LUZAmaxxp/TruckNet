/**
 * In-memory driver location store.
 *
 * Stores the most recent known location for every connected driver.
 * Used for sub-500ms nearby driver calculations without hitting the DB on
 * every socket event.
 *
 * Designed to be replaced by a Redis adapter for multi-instance deployments
 * without changing handler code — just swap the Map for a Redis client at
 * this abstraction boundary.
 */

export interface DriverLocationEntry {
  userId: string;
  latitude: number;
  longitude: number;
  socketId: string;
  updatedAt: Date;
}

const store = new Map<string, DriverLocationEntry>();

/**
 * Set or update a driver's location in the store.
 */
export function setDriverLocation(
  userId: string,
  entry: Omit<DriverLocationEntry, "userId">
): void {
  store.set(userId, { userId, ...entry });
}

/**
 * Get a single driver's location entry.
 */
export function getDriverLocation(
  userId: string
): DriverLocationEntry | undefined {
  return store.get(userId);
}

/**
 * Remove a driver from the store on disconnect.
 */
export function removeDriverLocation(userId: string): void {
  store.delete(userId);
}

/**
 * Get all currently tracked driver location entries.
 * Returns a snapshot array — safe to iterate while the Map mutates.
 */
export function getAllDriverLocations(): DriverLocationEntry[] {
  return Array.from(store.values());
}

/**
 * Returns the total number of tracked drivers.
 * Useful for monitoring and diagnostics.
 */
export function getDriverCount(): number {
  return store.size;
}
