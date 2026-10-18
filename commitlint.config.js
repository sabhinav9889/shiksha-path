/** Conventional commits: type(scope): subject — see .claude/rules/git-and-pr.md */
const HEADER_MAX = 100;
const SUBJECT_MIN = 10;
const BODY_LINE_MAX = 300;
const FOOTER_LINE_MAX = 100;

export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat',
        'fix',
        'docs',
        'style',
        'refactor',
        'perf',
        'test',
        'build',
        'ci',
        'chore',
        'revert',
      ],
    ],
    'type-empty': [2, 'never'],
    'scope-case': [2, 'always', 'kebab-case'],
    'scope-empty': [1, 'never'],
    'subject-case': [0],
    'subject-empty': [2, 'never'],
    'subject-full-stop': [2, 'never', '.'],
    'subject-min-length': [2, 'always', SUBJECT_MIN],
    'header-max-length': [2, 'always', HEADER_MAX],
    'body-leading-blank': [2, 'always'],
    'body-max-line-length': [2, 'always', BODY_LINE_MAX],
    'footer-leading-blank': [2, 'always'],
    'footer-max-line-length': [2, 'always', FOOTER_LINE_MAX],
  },
};
