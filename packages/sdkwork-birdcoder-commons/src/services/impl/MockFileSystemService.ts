import type { IFileNode, LocalFolderMountSource } from '@sdkwork/birdcoder-types';
import type { IFileSystemService } from '../interfaces/IFileSystemService';

const MOCK_FILES: IFileNode[] = [
  { name: '.env.example', type: 'file', path: '/.env.example' },
  { name: '.gitignore', type: 'file', path: '/.gitignore' },
  { name: 'index.html', type: 'file', path: '/index.html' },
  { name: 'metadata.json', type: 'file', path: '/metadata.json' },
  { name: 'package-lock.json', type: 'file', path: '/package-lock.json' },
  { name: 'package.json', type: 'file', path: '/package.json' },
  { 
    name: 'packages', 
    type: 'directory', 
    path: '/packages',
    children: [
      {
        name: 'sdkwork-birdcoder-code',
        type: 'directory',
        path: '/packages/sdkwork-birdcoder-code',
        children: [
          {
            name: 'src',
            type: 'directory',
            path: '/packages/sdkwork-birdcoder-code/src',
            children: [
              { name: 'index.ts', type: 'file', path: '/packages/sdkwork-birdcoder-code/src/index.ts' },
              {
                name: 'pages',
                type: 'directory',
                path: '/packages/sdkwork-birdcoder-code/src/pages',
                children: [
                  { name: 'CodePage.tsx', type: 'file', path: '/packages/sdkwork-birdcoder-code/src/pages/CodePage.tsx' }
                ]
              }
            ]
          }
        ]
      }
    ]
  },
  {
    name: 'src',
    type: 'directory',
    path: '/src',
    children: [
      { name: 'App.tsx', type: 'file', path: '/src/App.tsx' },
      { name: 'index.css', type: 'file', path: '/src/index.css' },
      { name: 'main.tsx', type: 'file', path: '/src/main.tsx' }
    ]
  },
  { name: 'tsconfig.json', type: 'file', path: '/tsconfig.json' },
  { name: 'vite.config.ts', type: 'file', path: '/vite.config.ts' }
];

const MOCK_FILE_CONTENT: Record<string, string> = {
  '/.env.example': 'GEMINI_API_KEY=\nAPP_URL=',
  '/.gitignore': 'node_modules\ndist\n.env',
  '/index.html': '<!DOCTYPE html>\n<html lang="en">\n  <head>\n    <meta charset="UTF-8" />\n    <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n    <title>Vite + React + TS</title>\n  </head>\n  <body>\n    <div id="root"></div>\n    <script type="module" src="/src/main.tsx"></script>\n  </body>\n</html>',
  '/metadata.json': '{\n  "name": "",\n  "description": "",\n  "requestFramePermissions": []\n}',
  '/package.json': '{\n  "name": "sdkwork-birdcoder-workspace",\n  "private": true,\n  "version": "0.1.0",\n  "type": "module",\n  "scripts": {\n    "dev": "vite",\n    "build": "tsc && vite build",\n    "lint": "eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0",\n    "preview": "vite preview"\n  }\n}',
  '/src/App.tsx': 'import React from "react";\n\nexport default function App() {\n  return <div>Hello World</div>;\n}',
  '/src/index.css': '@tailwind base;\n@tailwind components;\n@tailwind utilities;',
  '/src/main.tsx': 'import React from "react";\nimport ReactDOM from "react-dom/client";\nimport App from "./App.tsx";\nimport "./index.css";\n\nReactDOM.createRoot(document.getElementById("root")!).render(\n  <React.StrictMode>\n    <App />\n  </React.StrictMode>\n);',
  '/tsconfig.json': '{\n  "compilerOptions": {\n    "target": "ES2020",\n    "useDefineForClassFields": true,\n    "lib": ["ES2020", "DOM", "DOM.Iterable"],\n    "module": "ESNext",\n    "skipLibCheck": true,\n    "moduleResolution": "bundler",\n    "allowImportingTsExtensions": true,\n    "resolveJsonModule": true,\n    "isolatedModules": true,\n    "noEmit": true,\n    "jsx": "react-jsx",\n    "strict": true,\n    "noUnusedLocals": true,\n    "noUnusedParameters": true,\n    "noFallthroughCasesInSwitch": true\n  },\n  "include": ["src"],\n  "references": [{ "path": "./tsconfig.node.json" }]\n}',
  '/vite.config.ts': 'import { defineConfig } from "vite";\nimport react from "@vitejs/plugin-react";\n\nexport default defineConfig({\n  plugins: [react()],\n});'
};

export class MockFileSystemService implements IFileSystemService {
  private projectFiles: Record<string, IFileNode[]> = {
    'p1': [...MOCK_FILES]
  };
  private projectFileContent: Record<string, Record<string, string>> = {
    'p1': {...MOCK_FILE_CONTENT}
  };

  async getFiles(projectId: string): Promise<IFileNode[]> {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(this.projectFiles[projectId] || []);
      }, 100);
    });
  }

  async getFileContent(projectId: string, path: string): Promise<string> {
    return new Promise((resolve) => {
      setTimeout(() => {
        const contentMap = this.projectFileContent[projectId] || {};
        if (contentMap[path] !== undefined) {
          resolve(contentMap[path]);
        } else {
          resolve('// File content not found');
        }
      }, 50);
    });
  }

  async saveFileContent(projectId: string, path: string, content: string): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(() => {
        if (!this.projectFileContent[projectId]) {
          this.projectFileContent[projectId] = {};
        }
        this.projectFileContent[projectId][path] = content;
        
        // Add to tree if it doesn't exist
        const tree = this.projectFiles[projectId];
        if (tree) {
          const pathParts = path.split('/').filter(Boolean);
          const fileName = pathParts[pathParts.length - 1];
          const newNode: IFileNode = {
            name: fileName,
            type: 'file',
            path: path
          };
          this.addNodeToTree(tree, pathParts, newNode);
        }
        
        resolve();
      }, 50);
    });
  }

  private addNodeToTree(nodes: IFileNode[], pathParts: string[], nodeToAdd: IFileNode, currentPath: string = ''): boolean {
    if (pathParts.length === 1) {
      // We are at the parent directory, add the node here
      // Check if it already exists
      const existingIndex = nodes.findIndex(n => n.name === nodeToAdd.name);
      if (existingIndex >= 0) {
        nodes[existingIndex] = nodeToAdd;
      } else {
        nodes.push(nodeToAdd);
      }
      return true;
    }

    const dirName = pathParts[0];
    const nextPath = `${currentPath}/${dirName}`;
    let dirNode = nodes.find(n => n.name === dirName && n.type === 'directory');

    if (!dirNode) {
      // Create missing intermediate directory
      dirNode = {
        name: dirName,
        type: 'directory',
        path: nextPath,
        children: []
      };
      nodes.push(dirNode);
    }

    if (!dirNode.children) {
      dirNode.children = [];
    }

    return this.addNodeToTree(dirNode.children, pathParts.slice(1), nodeToAdd, nextPath);
  }

  async createFile(projectId: string, path: string): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(() => {
        if (!this.projectFiles[projectId]) {
          this.projectFiles[projectId] = [];
        }
        if (!this.projectFileContent[projectId]) {
          this.projectFileContent[projectId] = {};
        }
        
        const parts = path.split('/').filter(Boolean);
        const fileName = parts[parts.length - 1];
        
        const newNode: IFileNode = {
          name: fileName,
          type: 'file',
          path: path
        };
        
        this.addNodeToTree(this.projectFiles[projectId], parts, newNode);
        this.projectFileContent[projectId][path] = '';
        resolve();
      }, 50);
    });
  }

  async createFolder(projectId: string, path: string): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(() => {
        if (!this.projectFiles[projectId]) {
          this.projectFiles[projectId] = [];
        }
        
        const parts = path.split('/').filter(Boolean);
        const folderName = parts[parts.length - 1];
        
        const newNode: IFileNode = {
          name: folderName,
          type: 'directory',
          path: path,
          children: []
        };
        
        this.addNodeToTree(this.projectFiles[projectId], parts, newNode);
        resolve();
      }, 50);
    });
  }

  private removeNodeFromTree(nodes: IFileNode[], pathParts: string[]): boolean {
    if (pathParts.length === 1) {
      const index = nodes.findIndex(n => n.name === pathParts[0]);
      if (index >= 0) {
        nodes.splice(index, 1);
        return true;
      }
      return false;
    }

    const dirName = pathParts[0];
    const dirNode = nodes.find(n => n.name === dirName && n.type === 'directory');
    
    if (dirNode && dirNode.children) {
      return this.removeNodeFromTree(dirNode.children, pathParts.slice(1));
    }
    return false;
  }

  async deleteFile(projectId: string, path: string): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(() => {
        if (!this.projectFiles[projectId]) return resolve();
        
        const parts = path.split('/').filter(Boolean);
        this.removeNodeFromTree(this.projectFiles[projectId], parts);
        
        if (this.projectFileContent[projectId]) {
          delete this.projectFileContent[projectId][path];
        }
        
        resolve();
      }, 50);
    });
  }

  async deleteFolder(projectId: string, path: string): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(() => {
        if (!this.projectFiles[projectId]) return resolve();
        
        const parts = path.split('/').filter(Boolean);
        this.removeNodeFromTree(this.projectFiles[projectId], parts);
        
        // Also remove all file contents under this folder
        if (this.projectFileContent[projectId]) {
          const prefix = `${path}/`;
          Object.keys(this.projectFileContent[projectId]).forEach(key => {
            if (key.startsWith(prefix)) {
              delete this.projectFileContent[projectId][key];
            }
          });
        }
        
        resolve();
      }, 50);
    });
  }

  private renameNodeInTree(nodes: IFileNode[], pathParts: string[], newName: string, newPath: string): boolean {
    if (pathParts.length === 1) {
      const node = nodes.find(n => n.name === pathParts[0]);
      if (node) {
        node.name = newName;
        node.path = newPath;
        // If it's a directory, we also need to update all children's paths
        if (node.type === 'directory' && node.children) {
          this.updateChildrenPaths(node.children, newPath);
        }
        return true;
      }
      return false;
    }

    const dirName = pathParts[0];
    const dirNode = nodes.find(n => n.name === dirName && n.type === 'directory');
    
    if (dirNode && dirNode.children) {
      return this.renameNodeInTree(dirNode.children, pathParts.slice(1), newName, newPath);
    }
    return false;
  }

  private updateChildrenPaths(nodes: IFileNode[], parentPath: string) {
    for (const node of nodes) {
      node.path = parentPath === '/' ? `/${node.name}` : `${parentPath}/${node.name}`;
      if (node.type === 'directory' && node.children) {
        this.updateChildrenPaths(node.children, node.path);
      }
    }
  }

  async renameNode(projectId: string, oldPath: string, newPath: string): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(() => {
        if (!this.projectFiles[projectId]) return resolve();
        
        const oldParts = oldPath.split('/').filter(Boolean);
        const newParts = newPath.split('/').filter(Boolean);
        const newName = newParts[newParts.length - 1];
        
        this.renameNodeInTree(this.projectFiles[projectId], oldParts, newName, newPath);
        
        // Also update file contents keys
        if (this.projectFileContent[projectId]) {
          // If it's a file
          if (this.projectFileContent[projectId][oldPath] !== undefined) {
            this.projectFileContent[projectId][newPath] = this.projectFileContent[projectId][oldPath];
            delete this.projectFileContent[projectId][oldPath];
          } else {
            // If it's a folder, update all files under it
            const oldPrefix = `${oldPath}/`;
            const newPrefix = `${newPath}/`;
            Object.keys(this.projectFileContent[projectId]).forEach(key => {
              if (key.startsWith(oldPrefix)) {
                const newKey = key.replace(oldPrefix, newPrefix);
                this.projectFileContent[projectId][newKey] = this.projectFileContent[projectId][key];
                delete this.projectFileContent[projectId][key];
              }
            });
          }
        }
        
        resolve();
      }, 50);
    });
  }

  async mountFolder(projectId: string, folderInfo: LocalFolderMountSource): Promise<void> {
    // In a real implementation, this would read the local folder and populate the file system
    // For the mock, we'll just create a dummy structure to simulate the mounted folder
    return new Promise((resolve) => {
      setTimeout(() => {
        const folderName =
          folderInfo.type === 'browser'
            ? folderInfo.handle.name
            : folderInfo.path.split(/[/\\]/).pop() || 'Mounted Folder';
        
        this.projectFiles[projectId] = [
          {
            name: folderName,
            type: 'directory',
            path: `/${folderName}`,
            children: [
              { name: 'index.ts', type: 'file', path: `/${folderName}/index.ts` },
              { name: 'README.md', type: 'file', path: `/${folderName}/README.md` }
            ]
          }
        ];
        
        this.projectFileContent[projectId] = {
          [`/${folderName}/index.ts`]: '// Mounted file content\nconsole.log("Hello from mounted folder");',
          [`/${folderName}/README.md`]: '# Mounted Folder\n\nThis is a simulated mounted folder.'
        };
        
        resolve();
      }, 500);
    });
  }
}
