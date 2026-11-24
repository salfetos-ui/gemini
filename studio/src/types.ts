export type SceneId =
  | "scene_01"
  | "scene_02"
  | "scene_03"
  | "scene_04"
  | "scene_05"
  | "scene_06"
  | "scene_07"
  | "scene_08a"
  | "scene_08b"
  | "scene_09"
  | "scene_10"
  | "scene_11_outro";

export interface DialogueBeat {
  id?: string;
  speaker?: string;
  text?: string;
  startSec: number;
  endSec: number;
  sceneId?: string;
}

export interface SceneTiming {
  id: SceneId;
  imageFile?: string;
  startSec: number;
  endSec: number;
  /** Cross-dissolve duration entering this scene (seconds) */
  transitionSec: number;
  /** For two-beat scenes like scene_10 (10a -> 10b camera pull-back) or scene_08a second pulse */
  beatSplitSec?: number;
  /** Optional dialogue timestamps falling inside this scene for subtle audio-reactive glow/motion */
  dialogueBeats?: DialogueBeat[];
}

export interface FilmTimeline {
  fps: number;
  width: number;
  height: number;
  totalDurationSec: number;
  hasAudio: boolean;
  audioFile?: string;
  isFallback?: boolean;
  scenes: SceneTiming[];
}
