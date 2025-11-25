/**
 * Spatial Audio Module
 * 
 * Exports for 3D audio positioning, binaural panning, and distance effects.
 * 
 * @module audio/spatial
 */

// Spatial Node (3D panner wrapper)
export {
  SpatialNode,
  type Vector3,
  type DistanceModel,
  type PanningModel,
  type SpatialNodeParams,
} from './SpatialNode';

// Audio Listener Manager
export {
  AudioListenerManager,
  type ListenerState,
  type AudioListenerConfig,
} from './AudioListenerManager';
