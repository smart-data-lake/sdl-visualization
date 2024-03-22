import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { NodeGlobalsPolyfillPlugin } from '@esbuild-plugins/node-globals-polyfill';
import { NodeModulesPolyfillPlugin } from '@esbuild-plugins/node-modules-polyfill';
import rollupNodePolyFill from 'rollup-plugin-polyfill-node';

export default defineConfig(() => {
  return {
    build: {
      outDir: 'build',
      publicDir: './public',
      commonjsOptions: {
        dynamicRequireTargets: [
          "node_modules/@pushcorn/hocon-parser/lib/**/*.js"
        ],
      },
      rollupOptions: {
        plugins: [
          rollupNodePolyFill()
        ]
      }      
    },
    optimizeDeps: {
      esbuildOptions: {
        // Node.js global to browser globalThis
        define: {
          global: 'globalThis'
        },
        // Enable esbuild polyfill plugins
        plugins: [
          NodeGlobalsPolyfillPlugin({
            buffer: true, 
            process: true,
          }), 
          NodeModulesPolyfillPlugin() 
        ]
      }
    },    
    plugins: [
      react()
    ]
  };
});