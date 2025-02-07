import { createClient } from '@openauthjs/openauth/client';
import type { RequestEvent } from '@sveltejs/kit';

export function createAuthClient(event: RequestEvent) {
	return createClient({
		clientID: 'openauth-sveltekit-example',
		issuer: 'http://localhost:3000',
		fetch: event.fetch
	});
}

export function setTokens(event: RequestEvent, access: string, refresh: string) {
	event.cookies.set('refresh_token', refresh, {
		httpOnly: true,
		sameSite: 'lax',
		path: '/',
		maxAge: 34560000
	});
	event.cookies.set('access_token', access, {
		httpOnly: true,
		sameSite: 'lax',
		path: '/',
		maxAge: 34560000
	});
}