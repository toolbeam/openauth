import { redirect } from '@sveltejs/kit';
import { createAuthClient, setTokens } from '$lib/auth.server.js';

export async function GET(event) {
	const code = event.url.searchParams.get('code');
	const authClient = createAuthClient(event);
	const tokens = await authClient.exchange(code!, event.url.origin + '/callback');
	if (!tokens.err) {
		setTokens(event, tokens.tokens.access, tokens.tokens.refresh);
	} else {
		throw tokens.err;
	}
	return redirect(302, `/`);
}