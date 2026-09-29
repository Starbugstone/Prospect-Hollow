// Hash routes keep the panel one page: #/, #/players[/id], #/towns[/id], #/admins, #/log.
const SECTIONS = ['overview', 'players', 'towns', 'admins', 'log'];
export function parseRoute(hash) {
  const [section = '', id = ''] = hash.replace(/^#\/?/, '').split('/');
  return SECTIONS.includes(section)
    ? { section, id: decodeURIComponent(id) }
    : { section: 'overview', id: '' };
}
