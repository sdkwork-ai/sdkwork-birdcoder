export interface Skill {
  id: string;
  packageId: string;
  name: string;
  desc: string;
  icon: string;
  installs: string;
  author: string;
  longDesc?: string;
  version?: string;
  tags?: string[];
  isInstalled?: boolean;
  license?: string;
  repository?: string;
  lastUpdated?: string;
  readme?: string;
}

export interface SkillPackage {
  id: string;
  name: string;
  desc: string;
  icon: string;
  installs: string;
  author: string;
  version: string;
  isInstalled?: boolean;
  longDesc?: string;
  sourceUri?: string;
  skills: Skill[];
}
