import { defineConfig } from 'vite'
import solid from 'vite-plugin-solid'

export default defineConfig({
    publicDir: 'assets',
    plugins: [solid()],
})