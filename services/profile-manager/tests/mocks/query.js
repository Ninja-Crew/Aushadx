export function chainableQuery(result) {
  return {
    select: async () => result,
  };
}
