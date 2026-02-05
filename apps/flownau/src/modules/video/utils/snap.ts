/**
 * Snap-to-Grid Utilities
 * Provides magnetic snapping functionality for timeline operations
 */

const SNAP_THRESHOLD_FRAMES = 3 // Snap within 3 frames

export interface SnapPoint {
  frame: number
  type: 'element-start' | 'element-end' | 'playhead' | 'timeline-start' | 'timeline-end'
  elementId?: string
}

/**
 * Snaps a frame value to the nearest snap point if within threshold
 */
export function snapToNearestFrame(
  targetFrame: number,
  snapPoints: SnapPoint[],
  threshold: number = SNAP_THRESHOLD_FRAMES,
): { snappedFrame: number; snapPoint: SnapPoint | null } {
  let closestSnap: SnapPoint | null = null
  let closestDistance = Infinity

  for (const point of snapPoints) {
    const distance = Math.abs(point.frame - targetFrame)
    if (distance < closestDistance && distance <= threshold) {
      closestDistance = distance
      closestSnap = point
    }
  }

  return {
    snappedFrame: closestSnap ? closestSnap.frame : targetFrame,
    snapPoint: closestSnap,
  }
}

/**
 * Generates snap points from template elements
 */
export function generateSnapPoints(
  elements: Array<{ id: string; startFrame: number; durationInFrames: number }>,
  currentFrame: number,
  durationInFrames: number,
  excludeElementIds?: string[],
): SnapPoint[] {
  const snapPoints: SnapPoint[] = []

  // Timeline boundaries
  snapPoints.push({ frame: 0, type: 'timeline-start' })
  snapPoints.push({ frame: durationInFrames, type: 'timeline-end' })

  // Playhead
  snapPoints.push({ frame: currentFrame, type: 'playhead' })

  // Element boundaries
  for (const element of elements) {
    if (excludeElementIds?.includes(element.id)) continue

    snapPoints.push({
      frame: element.startFrame,
      type: 'element-start',
      elementId: element.id,
    })

    snapPoints.push({
      frame: element.startFrame + element.durationInFrames,
      type: 'element-end',
      elementId: element.id,
    })
  }

  return snapPoints
}

/**
 * Snaps element drag/resize operations
 */
export function snapElementOperation(
  proposedFrame: number,
  elements: Array<{ id: string; startFrame: number; durationInFrames: number }>,
  currentFrame: number,
  durationInFrames: number,
  excludeElementId?: string,
): { snappedFrame: number; snapPoint: SnapPoint | null } {
  const snapPoints = generateSnapPoints(
    elements,
    currentFrame,
    durationInFrames,
    excludeElementId ? [excludeElementId] : undefined,
  )

  return snapToNearestFrame(proposedFrame, snapPoints)
}
