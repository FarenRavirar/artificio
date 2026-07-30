export function canDeleteComment(input: {
  actorId: string;
  ownerId: string;
  localRole: string;
  isGlobalModerator: boolean;
}): boolean {
  return input.actorId === input.ownerId || input.localRole === 'admin' || input.isGlobalModerator;
}
