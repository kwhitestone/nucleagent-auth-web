export function mustDelegateAuthMutationsToShell(isEmbedded: boolean): boolean {
  return !isEmbedded;
}
