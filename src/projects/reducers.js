import { combineReducers } from 'redux';
import * as actions from './actions';


function contents(state = [], action) {
  switch (action.type) {
    case actions.CONTENTS_SUCCEEDED:
      return action.payload;
    case actions.CONTENTS_FAILED:
      return [];
    default:
      return state;
  }
}

function path(state = '/', action) {
  switch (action.type) {
    case actions.CONTENTS_PATH:
      return action.payload.path;
    default:
      return state;
  }
}

function stats(state = {}, action) {
  switch (action.type) {
    case actions.PROJECTS_STATS_SUCCEEDED:
      return action.payload;
    default:
      return state;
  }
}


// export reducer as default ot be combined at unknown key at root level
export default combineReducers({
  contents,
  path,
  stats,
});

// define selectors here as well, these should match the structure in
// combined reducer.
export const getContents = state => state.contents;

export const getPath = state => state.path;

export const getStats = state => state.stats;
