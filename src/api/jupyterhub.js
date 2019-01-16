import axios from 'axios';
import { CANCEL } from 'redux-saga';
import { getKeycloak } from './keycloak';
import { getConfig } from '../config';

// TODO: think about keeping 'username' somewhere global or get it from state tree
//       instead of passing it down through every API call.
//       We need username to mint tokens if needed.

let client;

export function getHubUrl() {
  return getConfig('jupyterhub').url;
}

function getStoredToken(username) {
  try {
    const tokens = JSON.parse(localStorage.getItem('jupyterhub_api_token'));
    if (typeof tokens !== 'object') {
      return null;
    }
    return tokens[username];
  } catch (error) {
    return null;
  }
}

function setStoredToken(username, token) {
  let tokens = {};
  try {
    tokens = JSON.parse(localStorage.getItem('jupyterhub_api_token'));
    if (typeof tokens !== 'object') {
      tokens = {};
    }
  } catch (error) {
    // nothing to do here ... just ignore stuff form localstorage
    tokens = {};
  }
  tokens[username] = token;
  localStorage.setItem('jupyterhub_api_token', JSON.stringify(tokens));
}

function delStoredToken(username) {
  let tokens = {};
  try {
    tokens = JSON.parse(localStorage.getItem('jupyterhub_api_token'));
    if (typeof tokens !== 'object') {
      tokens = {};
    }
  } catch (error) {
    // nothing to do here ... just ignore stuff form localstorage
    tokens = {};
  }
  delete tokens[username];
  localStorage.setItem('jupyterhub_api_token', JSON.stringify(tokens));
}

function getToken(username) {
  // return jupytrehub API token....
  const kc = getKeycloak();
  return kc.updateToken()
    .then(() => {
      const token = getStoredToken(username);
      if (!token) {
        // we need a new jupyterhub api token
        return axios({
          url: `hub/api/users/${username}/tokens`,
          baseURL: getHubUrl(),
          method: 'POST',
          data: {
            auth: { token: kc.token },
            note: navigator.userAgent,
            // valid for one week
            expires_in: 604800,
          },
        }).catch((error) => {
          // create token failed ?
          throw error;
        }).then((resp) => {
          // apiToken may have: created, id, kind, last_activity, note, token, user
          setStoredToken(username, resp.data.token);
          return resp.data.token;
        });
      }
      return token;
    })
    .catch((error) => {
      // console.log('Token refresh failed: ', error);
      throw error;
    });
}

// FIXME: almost duplicate code
function getClient(username) {
  if (!client) {
    client = axios.create({
      baseURL: getHubUrl(),
    });
    // add auth interceptor
    client.interceptors.request.use(
      config => getToken(username)
        .then((apiToken) => {
          const newConfig = config;
          if (apiToken) {
            newConfig.headers.Authorization = `token ${apiToken}`;
          }
          return newConfig;
        })
        .catch((error) => {
          // console.log('Token mint failed: ', error);
          throw error;
        }),
      // Do something with request error
      error => Promise.reject(error),
    );
  }
  return client;
}

// FIXME: duplicate code
function callAPI(options, username) {
  // returns a cancelable promise
  const cancel = axios.CancelToken.source();
  const opts = {
    ...options,
    cancelToken: cancel.token,
  };
  const promise = getClient(username).request(opts)
    .catch((error) => {
      // TODO: we probabsy should retry with fetching a new token
      //       if (error.request.status == 403) ...
      // TODO: any other errors we should handle here?
      delStoredToken(username);
      throw error;
    });
  return { promise, cancel: cancel.cancel };
}


export function getUser(username) {
  const { promise, cancel } = callAPI({ url: `hub/api/users/${username}` }, username);
  const data = promise.then(response => response.data);
  data[CANCEL] = cancel;
  return data;
}

export function launchServer({ username, profile, flavour }) {
  const serverData = {
    profile, flavour,
  };
  const { promise, cancel } = callAPI({ url: `hub/api/users/${username}/server`, method: 'POST', data: serverData }, username);
  const data = promise.then(response => response.data);
  data[CANCEL] = cancel;
  return data;
}

export function terminateServer(username) {
  const { promise, cancel } = callAPI({ url: `hub/api/users/${username}/server`, method: 'DELETE' }, username);
  const data = promise.then(response => response.data);
  data[CANCEL] = cancel;
  return data;
}

export function getProfiles(username) {
  const { promise, cancel } = callAPI({ url: 'services/ecocloud/profile_list' }, username);
  const data = promise.then(response => response.data);
  data[CANCEL] = cancel;
  return data;
}
