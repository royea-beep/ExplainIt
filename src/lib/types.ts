// Shared types used across capture-engine, video-producer, pdf-generator, and API routes

export interface ElementInfo {
  id: number;
  type: string;
  label: string;
  selector: string;
  bounds: { x: number; y: number; width: number; height: number };
}

export interface ScreenInfo {
  id: string;
  name: string;
  url: string;
  route: string;
  screenshotPath: string;
  description: string;
  elements: ElementInfo[];
}

export interface FlowStep {
  order: number;
  action: string;
  target: string;
  description: string;
}

export interface FlowInfo {
  id: string;
  name: string;
  screenId: string;
  steps: FlowStep[];
}
