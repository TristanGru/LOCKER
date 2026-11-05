import { request, type FullConfig } from '@playwright/test';
import { FLEET_STATE } from '../playwright.config';

/** Sign in once as the fleet account and save the session cookie for every test. */
export default async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0].use.baseURL;
  const context = await request.newContext({ baseURL });
  const response = await context.post('/api/login', { data: { username: 'fleet.commander@us.navy.mil' } });
  if (!response.ok()) throw new Error(`Fleet sign-in failed: ${response.status()} ${await response.text()}`);
  await context.storageState({ path: FLEET_STATE });
  await context.dispose();
}
