// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			session: { id: string; };
		}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
