// Restore the completed pose without replaying completion callbacks or animation.
export function restoreDisassemblyPlacement(group, rotation, targetPosition, targetQuaternion) {
  if (!group || !rotation || !targetPosition) return false;
  group.position.copy(targetPosition);
  rotation.quaternion.copy(targetQuaternion);
  group.updateMatrixWorld(true);
  return true;
}
