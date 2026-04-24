import * as GithubAPI from '../API/GithubAPI.js';
import {
  createConnectorCredentialHelpers,
  formatDateTime as safeDate,
  parseCommaList,
} from '../../../Core/ConnectorUtils.js';

const {
  getCredentials: getGithubCredentials,
  requireCredentials: requireGithubCredentials,
  notConnected,
  withCredentials: withGithub,
} = createConnectorCredentialHelpers({
  connectorId: 'github',
  requiredErrorMessage: 'GitHub not connected',
  notConnectedErrorMessage: 'GitHub not connected',
});

export {
  GithubAPI,
  getGithubCredentials,
  requireGithubCredentials,
  notConnected,
  parseCommaList,
  safeDate,
  withGithub,
};
