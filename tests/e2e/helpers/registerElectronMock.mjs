import { register } from 'node:module';

register(new URL('./electronHooks.mjs', import.meta.url));
