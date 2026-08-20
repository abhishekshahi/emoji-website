import type { ScoreComponents } from "./types";

export const EXPRESSIVENESS_V1_VERSION = "10.0.0-expressiveness-v1";

export function computeExpressivenessV1(content: string): { score: number; components: ScoreComponents } {
  const facialClarity = /[T^_oO0\.\-~]/.test(content) ? 80 : 45;
  const emotionClarity = /[♥♡❤😀-🙏]|[\u2600-\u27bf]/u.test(content) ? 75 : 55;
  const gestureClarity = /[\/\\|\u256f\u256d\u252c\u2534]/.test(content) ? 70 : 50;
  const visualEmphasis = Math.min(100, (content.match(/[!?~*]/g) ?? []).length * 15 + 50);
  const semanticRecognizability = /[()（）].*[()（）]/.test(content) ? 80 : 50;
  const components: ScoreComponents = {
    facial_clarity: facialClarity,
    emotion_clarity: emotionClarity,
    gesture_clarity: gestureClarity,
    visual_emphasis: visualEmphasis,
    semantic_recognizability: semanticRecognizability,
  };
  const score = Math.round(
    components.facial_clarity * 0.25 +
    components.emotion_clarity * 0.25 +
    components.gesture_clarity * 0.2 +
    components.visual_emphasis * 0.15 +
    components.semantic_recognizability * 0.15,
  );
  return { score: Math.min(100, Math.max(0, score)), components };
}
