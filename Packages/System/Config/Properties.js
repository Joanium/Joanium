export const Properties = {
  name: 'Joanium',
  version: '2026.430.1',
  description: 'Your smart, reliable, and friendly personal AI assistant.',
  author: 'Joel Jolly',
  authorUrl: 'https://joeljolly.vercel.app',
  sponsorUrl: 'https://github.com/sponsors/withinJoel',
  license: 'Apache-2.0',
  get repository() {
    return `https://github.com/${this.name}/${this.name}`;
  },
};
export const {
  version: version,
  name: appName,
  author: author,
  authorUrl: authorUrl,
  sponsorUrl: sponsorUrl,
  repository: repository,
} = Properties;
export default Properties;
