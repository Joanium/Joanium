export const Properties = {
  name: 'Joanium',
  version: '0.1.0',
  description: 'Your smart, reliable, and friendly personal AI assistant.',
  author: 'Joel Jolly',
  authorUrl: 'https://joeljolly.vercel.app',
  sponsorUrl: 'https://github.com/sponsors/withinJoel',
  license: 'MIT',
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
