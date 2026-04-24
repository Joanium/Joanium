import * as GitlabAPI from '../API/GitlabAPI.js';
import {
  createConnectorCredentialHelpers,
  formatDateTime as safeDate,
  parseCommaList,
} from '../../../Core/ConnectorUtils.js';

const {
  getCredentials: getGitlabCredentials,
  requireCredentials: requireGitlabCredentials,
  notConnected,
  withCredentials: withGitlab,
} = createConnectorCredentialHelpers({
  connectorId: 'gitlab',
  requiredErrorMessage: 'GitLab not connected',
  notConnectedErrorMessage: 'GitLab not connected',
});

export {
  GitlabAPI,
  getGitlabCredentials,
  requireGitlabCredentials,
  notConnected,
  parseCommaList,
  safeDate,
  withGitlab,
};
