import { createGameTool } from './createGame.js';
import { editGameTool } from './editGame.js';
import { runGameTool } from './runGame.js';
import { listGamesTool } from './listGames.js';
import { generateConfigTool } from './generateConfig.js';
import { debugGameTool } from './debugGame.js';
import { publishGameTool } from './publishGame.js';
import { describeGameTool } from './describeGame.js';
import { tweakParamsTool } from './tweakParams.js';
import { applyScenarioTool } from './applyScenario.js';
import { applyStyleThemeTool } from './applyStyleTheme.js';
import { viewCodeTool } from './viewCode.js';
import { debugWithDiffsTool } from './debugWithDiffs.js';
import { creativeIdeateTool } from './creativeIdeate.js';
import { proceduralLevelTool } from './proceduralLevel.js';
import { generateAssetTool } from './generateAsset.js';
import { generateNpcTool } from './generateNpc.js';
import { configureGameMetaTool } from './configureGameMeta.js';
import { rapidIterateTool } from './rapidIterate.js';
import { searchAssetLibraryTool } from './searchAssetLibrary.js';
import { editNodeGraphTool } from './editNodeGraph.js';
import { deleteGameTool } from './deleteGame.js';
import { saveGameTool } from './saveGame.js';
import { exploreCommunityTool } from './exploreCommunity.js';
import { installSnippetTool } from './installSnippet.js';
import { updateBasicInfoTool } from './updateBasicInfo.js';
import { remixGameTool } from './remixGame.js';
import { dispatchCrewTool } from './dispatchCrew.js';
import { exportGameTool } from './exportGame.js';
import { importGameTool } from './importGame.js';
import { screenshotGameTool } from './screenshotGame.js';
import { gameAnalyticsTool } from './gameAnalytics.js';
import { versionHistoryTool } from './versionHistory.js';
import { agentExplainTool } from './agentExplain.js';
import { editConfigFieldTool } from './editConfigField.js';
import { editScriptTool } from './editScript.js';
import { manageNpcTool } from './manageNpc.js';
import { manageAssetTool } from './manageAsset.js';
import { playTestTool } from './playTest.js';
import { aiSuggestTool } from './aiSuggest.js';
import { manageAchievementsTool } from './manageAchievements.js';
import { manageScenesTool } from './manageScenes.js';
import { manageLeaderboardTool } from './manageLeaderboard.js';
import { translateGameTool } from './translateGame.js';
import { balanceGameTool } from './balanceGame.js';
import { manageAudioTool } from './manageAudio.js';
import { generateStoryTool } from './generateStory.js';
import { profileGameTool } from './profileGame.js';
import { lintScriptsTool } from './lintScripts.js';
import { controlRuntimeTool } from './controlRuntime.js';
import { auditAccessibilityTool } from './auditAccessibility.js';
import { designProgressionTool } from './designProgression.js';
import { checkpointStateTool } from './checkpointState.js';
import { generateGameTemplateTool } from './generateGameTemplate.js';
import { analyzeFunFactorTool } from './analyzeFunFactor.js';
import { generateTutorialTool } from './generateTutorial.js';
import { undoRedoTool } from './undoRedo.js';
import { composeMusicTool } from './composeMusic.js';
import { generateDialogueTreeTool } from './generateDialogueTree.js';

/**
 * ToolRegistry - GenPlay toolchain registry.
 * Injects external services (gameService, provider, reflector, artifactMemory, assetLibrary)
 * into every tool so they can access data layer, LLM and side systems.
 * All tools may return editorActions that ChatPanel forwards to StudioPanel
 * via the events bus so frontend state reflects changes live.
 */
export class ToolRegistry {
  constructor(services = {}) {
    this.services = services;
    this.tools = new Map();
    this.registerDefaults();
  }

  registerDefaults() {
    this.register(createGameTool(this.services));
    this.register(editGameTool(this.services));
    this.register(runGameTool(this.services));
    this.register(listGamesTool(this.services));
    this.register(generateConfigTool(this.services));
    this.register(debugGameTool(this.services));
    this.register(publishGameTool(this.services));
    this.register(describeGameTool(this.services));
    this.register(tweakParamsTool(this.services));
    this.register(applyScenarioTool(this.services));
    this.register(applyStyleThemeTool(this.services));
    this.register(viewCodeTool(this.services));
    this.register(debugWithDiffsTool(this.services));
    this.register(creativeIdeateTool(this.services));
    this.register(proceduralLevelTool(this.services));
    this.register(generateAssetTool(this.services));
    this.register(generateNpcTool(this.services));
    this.register(configureGameMetaTool(this.services));
    this.register(rapidIterateTool(this.services));
    this.register(searchAssetLibraryTool(this.services));
    this.register(editNodeGraphTool(this.services));
    this.register(deleteGameTool(this.services));
    this.register(saveGameTool(this.services));
    this.register(exploreCommunityTool(this.services));
    this.register(installSnippetTool(this.services));
    this.register(updateBasicInfoTool(this.services));
    this.register(remixGameTool(this.services));
    this.register(dispatchCrewTool(this.services));
    this.register(exportGameTool(this.services));
    this.register(importGameTool(this.services));
    this.register(screenshotGameTool(this.services));
    this.register(gameAnalyticsTool(this.services));
    this.register(versionHistoryTool(this.services));
    this.register(agentExplainTool(this.services));
    this.register(editConfigFieldTool(this.services));
    this.register(editScriptTool(this.services));
    this.register(manageNpcTool(this.services));
    this.register(manageAssetTool(this.services));
    this.register(playTestTool(this.services));
    this.register(aiSuggestTool(this.services));
    this.register(manageAchievementsTool(this.services));
    this.register(manageScenesTool(this.services));
    this.register(manageLeaderboardTool(this.services));
    this.register(translateGameTool(this.services));
    this.register(balanceGameTool(this.services));
    this.register(manageAudioTool(this.services));
    this.register(generateStoryTool(this.services));
    this.register(profileGameTool(this.services));
    this.register(lintScriptsTool(this.services));
    this.register(controlRuntimeTool(this.services));
    this.register(auditAccessibilityTool(this.services));
    this.register(designProgressionTool(this.services));
    this.register(checkpointStateTool(this.services));
    this.register(generateGameTemplateTool(this.services));
    this.register(analyzeFunFactorTool(this.services));
    this.register(generateTutorialTool(this.services));
    this.register(undoRedoTool(this.services));
    this.register(composeMusicTool(this.services));
    this.register(generateDialogueTreeTool(this.services));
  }

  setProvider(provider) {
    this.services.provider = provider;
    this.registerDefaults();
  }
  setReflector(reflector) {
    this.services.reflector = reflector;
    this.registerDefaults();
  }
  setArtifactMemory(artifactMemory) {
    this.services.artifactMemory = artifactMemory;
    this.registerDefaults();
  }
  setAssetLibrary(assetLibrary) {
    this.services.assetLibrary = assetLibrary;
    this.registerDefaults();
  }
  setUndoManager(undoManager) {
    this.services.undoManager = undoManager;
    this.registerDefaults();
  }

  register(tool) { this.tools.set(tool.name, tool); }
  has(name) { return this.tools.has(name); }
  get(name) { return this.tools.get(name) || null; }

  async invoke(name, args, context = {}) {
    const tool = this.tools.get(name);
    if (!tool) return { ok: false, error: `Unknown tool: ${name}` };
    try {
      const raw = await tool.execute({ ...context, ...args });
      if (!raw || typeof raw !== 'object') return { ok: false, error: 'Tool returned invalid shape' };
      if (raw.ok === undefined) raw.ok = true;
      return raw;
    } catch (err) {
      return { ok: false, error: err.message || String(err) };
    }
  }

  describe() {
    return Array.from(this.tools.values()).map((t) => ({
      name: t.name, description: t.description, parameters: t.parameters,
    }));
  }

  listNames() { return Array.from(this.tools.keys()); }
}
