import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const plugins = [react()] as any;

export default defineConfig({
  plugins,
});
