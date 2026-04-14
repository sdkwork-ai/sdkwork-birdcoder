import { runDesktopStartupGraphContract } from './desktop-startup-graph-contract.mjs';

const visitedCount = await runDesktopStartupGraphContract();

console.log(`desktop startup graph contract passed for ${visitedCount} requested modules.`);
