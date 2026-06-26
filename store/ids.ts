let idSeq = 0;
export const nextId = () =>
  `m${Date.now().toString(36)}${(idSeq++).toString(36)}`;
