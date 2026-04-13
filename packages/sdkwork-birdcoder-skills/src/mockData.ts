import { Skill, SkillPackage } from './types';

export const MOCK_SKILLS: Skill[] = [
  {
    id: 's1',
    name: 'React Expert',
    desc: 'Advanced React patterns, hooks, and performance optimization',
    icon: '⚛️',
    installs: '12k',
    author: 'Community',
    longDesc: 'This skill provides deep expertise in React, including advanced patterns like higher-order components, render props, custom hooks, and performance optimization techniques using useMemo and useCallback.',
    version: '1.2.0',
    tags: ['Frontend', 'React', 'UI'],
    license: 'MIT',
    repository: 'github.com/community/react-expert-skill',
    lastUpdated: '2 days ago',
    readme: `## React Expert Skill

This skill is designed to supercharge your React development workflow. It integrates directly into your IDE to provide real-time suggestions, pattern recognition, and performance profiling.

### Features
- **Hook Optimization**: Automatically suggests \`useMemo\` and \`useCallback\` where appropriate.
- **Component Refactoring**: One-click refactoring from class components to functional components.
- **State Management**: Deep integrations with Redux, Zustand, and Context API.

### Usage
Simply ask the AI:
> "How can I optimize this component's re-renders?"
> "Convert this class component to use hooks."

### Requirements
- React 16.8+
- TypeScript 4.5+ (recommended)
`
  },
  {
    id: 's2',
    name: 'Tailwind Master',
    desc: 'Utility-first CSS generation and responsive design',
    icon: '🌊',
    installs: '8.5k',
    author: 'Community',
    longDesc: 'Master Tailwind CSS with this skill. It helps you generate utility classes, build responsive layouts, and customize your Tailwind configuration for optimal design systems.',
    version: '2.0.1',
    tags: ['CSS', 'Design', 'Tailwind']
  },
  {
    id: 's3',
    name: 'Node.js Backend',
    desc: 'Express, API development, and database integration',
    icon: '🟢',
    installs: '15k',
    author: 'Community',
    longDesc: 'Build robust backend services with Node.js. This skill assists with Express.js routing, middleware creation, database connections (MongoDB, PostgreSQL), and RESTful API design.',
    version: '3.1.4',
    tags: ['Backend', 'Node.js', 'API']
  },
  {
    id: 's4',
    name: 'Python Data',
    desc: 'Pandas, NumPy, and data visualization assistance',
    icon: '🐍',
    installs: '20k',
    author: 'Community',
    longDesc: 'Your personal data science assistant. Get help with Python data manipulation using Pandas, numerical computations with NumPy, and creating stunning visualizations with Matplotlib and Seaborn.',
    version: '1.5.2',
    tags: ['Data Science', 'Python', 'Analytics']
  },
  {
    id: 's5',
    name: 'Docker Wizard',
    desc: 'Containerization and Docker Compose setups',
    icon: '🐳',
    installs: '18k',
    author: 'Community',
    longDesc: 'Simplify containerization with Docker Wizard. It generates Dockerfiles, docker-compose.yml configurations, and helps troubleshoot container networking and volume issues.',
    version: '2.2.0',
    tags: ['DevOps', 'Docker', 'Containers']
  },
  {
    id: 's6',
    name: 'AWS Architect',
    desc: 'Cloud infrastructure and serverless deployment',
    icon: '☁️',
    installs: '9.2k',
    author: 'Community',
    longDesc: 'Design scalable cloud architectures on AWS. This skill provides guidance on EC2, S3, Lambda, API Gateway, and helps write CloudFormation or Terraform scripts.',
    version: '1.0.5',
    tags: ['Cloud', 'AWS', 'Infrastructure']
  },
  {
    id: 's7',
    name: 'Sdkwork CLI',
    desc: 'Command line interface tools and automation scripts',
    icon: '🛠️',
    installs: '5k',
    author: 'Sdkwork',
    longDesc: 'Official Sdkwork CLI assistant. Automate your workflow, manage projects, and run custom scripts directly from your terminal using Sdkwork tools.',
    version: '1.0.0',
    tags: ['CLI', 'Automation', 'Sdkwork'],
    license: 'Apache 2.0',
    repository: 'github.com/sdkwork/cli-skill',
    lastUpdated: '5 hours ago',
    readme: `## Sdkwork CLI Official Skill

The official command-line companion for Sdkwork IDE. This skill bridges the gap between your terminal and the IDE's AI capabilities.

### Core Capabilities
- **Project Scaffolding**: Generate boilerplate code for new services instantly.
- **Automated Testing**: Run and analyze test suites with AI-powered failure explanations.
- **Deployment Scripts**: Generate secure, environment-specific deployment scripts.

### Quick Start
\`\`\`bash
# Initialize a new project
sdkwork init my-project

# Run AI analysis on your codebase
sdkwork analyze .
\`\`\`

Built with ❤️ by the Sdkwork Team.
`
  },
  {
    id: 's8',
    name: 'Sdkwork Deploy',
    desc: 'One-click deployment and CI/CD pipeline integration',
    icon: '🚀',
    installs: '3.2k',
    author: 'Sdkwork',
    longDesc: 'Seamlessly deploy your applications with Sdkwork Deploy. Set up CI/CD pipelines, manage environments, and monitor your deployments with ease.',
    version: '1.1.0',
    tags: ['Deployment', 'CI/CD', 'Sdkwork']
  },
  {
    id: 's9',
    name: 'Sdkwork Auth',
    desc: 'Authentication and authorization flows setup',
    icon: '🔐',
    installs: '4.1k',
    author: 'Sdkwork',
    longDesc: 'Implement secure authentication and authorization in your apps. This skill helps integrate OAuth, JWT, and role-based access control using Sdkwork Auth.',
    version: '2.0.0',
    tags: ['Security', 'Auth', 'Sdkwork']
  },
  {
    id: 's10',
    name: 'TypeScript Pro',
    desc: 'Strict typing, interfaces, and generic types assistance',
    icon: '📘',
    installs: '25k',
    author: 'Community',
    longDesc: 'Elevate your TypeScript code. Get help with complex type definitions, generics, utility types, and migrating JavaScript projects to strict TypeScript.',
    version: '4.5.0',
    tags: ['TypeScript', 'Frontend', 'Backend'],
    isInstalled: true
  },
  {
    id: 's11',
    name: 'Git Assistant',
    desc: 'Version control workflows, rebasing, and conflict resolution',
    icon: '🌿',
    installs: '30k',
    author: 'Community',
    longDesc: 'Master Git version control. This assistant helps you navigate complex branching strategies, perform interactive rebases, and resolve merge conflicts safely.',
    version: '2.1.0',
    tags: ['Git', 'VCS', 'Workflow'],
    isInstalled: true
  }
];

export const MOCK_PACKAGES: SkillPackage[] = [
  {
    id: 'p1',
    name: 'Fullstack Web Dev Bundle',
    desc: 'Everything you need to build modern web applications from frontend to backend.',
    icon: '🌐',
    installs: '45k',
    author: 'Sdkwork',
    longDesc: 'This comprehensive package includes top-tier skills for fullstack web development. It covers React for the frontend, Node.js for the backend, and Tailwind CSS for styling, providing a complete toolkit for modern web developers.',
    skills: [
      MOCK_SKILLS.find(s => s.id === 's1')!,
      MOCK_SKILLS.find(s => s.id === 's2')!,
      MOCK_SKILLS.find(s => s.id === 's3')!,
      MOCK_SKILLS.find(s => s.id === 's10')!
    ]
  },
  {
    id: 'p2',
    name: 'DevOps & Cloud Mastery',
    desc: 'Essential tools for containerization, deployment, and cloud infrastructure.',
    icon: '🏗️',
    installs: '22k',
    author: 'CloudExperts',
    longDesc: 'Streamline your deployment and infrastructure management with this DevOps package. It includes Docker for containerization, AWS for cloud architecture, and Git for version control workflows.',
    skills: [
      MOCK_SKILLS.find(s => s.id === 's5')!,
      MOCK_SKILLS.find(s => s.id === 's6')!,
      MOCK_SKILLS.find(s => s.id === 's11')!
    ]
  },
  {
    id: 'p3',
    name: 'Sdkwork Official Suite',
    desc: 'The complete collection of official Sdkwork tools and integrations.',
    icon: '✨',
    installs: '15k',
    author: 'Sdkwork',
    longDesc: 'Get the most out of the Sdkwork ecosystem with this official suite. It includes CLI tools, deployment automation, and secure authentication setups tailored for Sdkwork platforms.',
    skills: [
      MOCK_SKILLS.find(s => s.id === 's7')!,
      MOCK_SKILLS.find(s => s.id === 's8')!,
      MOCK_SKILLS.find(s => s.id === 's9')!
    ]
  }
];
