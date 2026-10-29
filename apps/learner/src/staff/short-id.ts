const SHORT_LENGTH = 4;

/** The first characters of an id, to tell two students with one name apart: `#a3f9`. */
export const shortId = (id: string): string => `#${id.replaceAll('-', '').slice(0, SHORT_LENGTH)}`;
