export interface Skill {
  id: string;
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
  longDesc?: string;
  skills: Skill[];
}
