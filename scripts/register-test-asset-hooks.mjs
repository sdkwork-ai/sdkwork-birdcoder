import { register } from 'node:module';

register(new URL('./test-asset-loader.mjs', import.meta.url));
