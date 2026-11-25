const LANGUAGE_COLORS = new Map([
  ['python', '#3B82F6'],
  ['python3', '#3B82F6'],
  ['javascript', '#F59E0B'],
  ['typescript', '#60A5FA'],
  ['java', '#F97316'],
  ['cpp', '#A78BFA'],
  ['c++', '#A78BFA'],
  ['c', '#6B7280'],
  ['go', '#34D399'],
  ['rust', '#FB923C'],
  ['ruby', '#F43F5E'],
  ['kotlin', '#818CF8'],
  ['swift', '#FF6E40'],
  ['scala', '#EF4444'],
  ['sql', '#22D3EE'],
])

export function codeLanguageColor(language = '') {
  return LANGUAGE_COLORS.get(language.toLowerCase()) ?? '#9CA3AF'
}
