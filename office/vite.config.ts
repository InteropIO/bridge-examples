import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
import { cp, mkdir } from 'node:fs/promises';

const repositoryName = process.env.GITHUB_REPOSITORY?.split('/')[1];
const githubPagesBase = repositoryName ? `/${repositoryName}/` : '/';
const base = process.env.VITE_PUBLIC_BASE ?? (process.env.GITHUB_ACTIONS === 'true' ? githubPagesBase : '/');

const modalsSourceDir = resolve(__dirname, 'node_modules/@interopio/modals-ui/dist');
const modalsPublicDir = resolve(__dirname, 'public/static/modals');
const modalsDistDir = resolve(__dirname, 'dist/static/modals');

const copyModalsAssets = async (targetDir: string) => {
    await mkdir(targetDir, { recursive: true });
    await cp(modalsSourceDir, targetDir, { recursive: true, force: true });
};

const copyModalsUiDistPlugin = () => ({
    name: 'copy-modals-ui-dist',
    async configureServer() {
        // Keep /static/modals available via Vite publicDir during dev.
        await copyModalsAssets(modalsPublicDir);
    },
    async buildStart() {
        // Ensure build picks up fresh modals assets from publicDir.
        await copyModalsAssets(modalsPublicDir);
    },
    async closeBundle() {
        await copyModalsAssets(modalsDistDir);
    }
});

// https://vitejs.dev/config/
export default defineConfig({
    base,
    plugins: [react(), copyModalsUiDistPlugin()],
    root: './src',
    envDir: '..',
    publicDir: '../public',
    resolve: {
        // Linked packages (file:../../connect-js/...) may bundle their own React version.
        // This causes multiple React instances and breaks hooks (error #525).
        // Force all React imports to resolve to this project's node_modules.
        dedupe: ['react', 'react-dom'],
        alias: {
            'react': resolve(__dirname, 'node_modules/react'),
            'react-dom': resolve(__dirname, 'node_modules/react-dom')
        }
    },
    build: {
        outDir: '../dist',
        emptyOutDir: true,
        rolldownOptions: {
            input: {
                main: resolve(__dirname, 'src/index.html'),
                outlook: resolve(__dirname, 'src/outlook/index.html')
            }
        }
    },
    server: {
        port: 5173,
        // https: {
        //     key: resolve(__dirname, 'gateway-server.key'),
        //     cert: resolve(__dirname, 'gateway-server.crt'),
        //     ca: resolve(__dirname, '../.secrets/io-bridge-ca.crt')
        // },
        hmr: {
            host: 'localhost'
        }
    }
});
