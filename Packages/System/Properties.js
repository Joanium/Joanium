const APP_NAME = 'Romelson';

export const Properties = {
  name: APP_NAME,
  version: '0.1.0',
  description: 'An Electron app that connects and controls your world',
  author: 'Joel Jolly',
  authorUrl: 'https://joeljolly.vercel.app',
  sponsorUrl: 'https://github.com/sponsors/withinJoel',
  license: 'MIT',

  get repository() {
    return `https://github.com/withinJoel/${this.name}`;
  },
};

// Safe destructuring (no name conflicts)
export const {
  version,
  name: appName,
  author,
  authorUrl,
  sponsorUrl,
  repository,
} = Properties;

export default Properties;
