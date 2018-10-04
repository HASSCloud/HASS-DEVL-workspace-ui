import React from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import { Link } from 'react-router-dom';
import {
  Row, Col, Container, Progress,
} from 'reactstrap';
import ReduxBlockUi from 'react-block-ui/redux';
import { Loader } from 'react-loaders';
import * as actions from './projects/actions';
import * as computeActions from './compute/actions';
import {
  getUser, getAuthenticated, getStats, getServers,
} from './reducers';
import { ComputeTableBasic } from './compute';
import { bytesToSize } from './utils';

function mapStateToProps(state) {
  return {
    user: getUser(state),
    isAuthenticated: getAuthenticated(state),
    stats: getStats(state),
    servers: getServers(state),
  };
}

function mapDispatchToProps(dispatch) {
  return {
    dispatch,
  };
}

export class Dashboard extends React.Component {
  static propTypes = {
    user: PropTypes.objectOf(PropTypes.any).isRequired,
    isAuthenticated: PropTypes.bool.isRequired,
    dispatch: PropTypes.func.isRequired,
    stats: PropTypes.objectOf(PropTypes.any).isRequired,
    servers: PropTypes.arrayOf(PropTypes.any).isRequired,
  }

  state = {
  }

  componentWillMount() {
    const { user } = this.props;

    // Start polling for JupyterHub server information
    this.props.dispatch(computeActions.serversListStart(user.sub));
  }

  componentDidMount() {
    this.props.dispatch(actions.getStats());
  }

  componentWillUnmount() {
    // Stop polling for JupyterHub server information
    this.props.dispatch(computeActions.serversListStop());
  }

  render() {
    const {
      user, isAuthenticated, stats, servers,
    } = this.props;

    // Quota figure can be `null`, in which case we replace with `0`
    const quota = stats.quota || 0;
    const { used } = stats;

    const usedBytes = bytesToSize(used, false);
    const totalBytes = bytesToSize(quota);

    // Usage is rendered as 0% usage when the quota itself is 0
    const usagePercent = quota === 0 ? 0 : (used / quota) * 100;
    const usageNum = `${usedBytes} / ${totalBytes}`;

    const progColor = () => {
      if (usagePercent < 50) return 'primary';
      if (usagePercent < 75) return 'warning';
      return 'danger';
    };

    return (
      <Container className="dashboard">
        <Row>
          <Col>
            { isAuthenticated
              && <h1>Welcome {user.name}</h1>
            }
          </Col>
        </Row>
        {/* <Row>
          <Col>
            <p>Welcome to Tinker. This is your Dashboard where you can access and manage your running services.</p>
            <p>Need help? Visit our <a href="#" target="_blank" rel="noopener noreferrer">support site</a>, or <a href="#" target="_blank" rel="noopener noreferrer">contact our support team</a>.</p>
          </Col>
        </Row> */}
        <Row>
          <Col sm={{ size: 12 }}>
            <Row>
              <Col sm="12">
                <h2>Servers</h2>
                <ReduxBlockUi tag="div" block={[computeActions.SERVERS_LIST, computeActions.SERVER_TERMINATE]} unblock={[computeActions.SERVERS_LIST_SUCCEEDED, computeActions.SERVERS_LIST_FAILED, computeActions.SERVER_TERMINATE_SUCCEEDED, computeActions.SERVER_TERMINATE_FAILED]} loader={<Loader active type="ball-pulse" />} className="loader">
                  <ComputeTableBasic servers={servers} username={user.sub} />
                </ReduxBlockUi>
              </Col>
            </Row>
            <Row>
              <Col sm="12">
                <h2>Workspace</h2>
                <div className="storage">
                  <ReduxBlockUi tag="div" block={actions.PROJECTS_STATS} unblock={[actions.PROJECTS_STATS_SUCCEEDED, actions.PROJECTS_STATS_FAILED]} loader={<Loader active type="ball-pulse" />} className="loader">
                    <p>Persistent storage used <span className="storage-int">{usageNum}</span></p>
                    <Progress color={progColor()} value={usagePercent} />
                  </ReduxBlockUi>
                </div>
              </Col>
            </Row>
            <Row>
              <Col sm="12">
                <h2>Find Datasets</h2>
                <p>Find datasets from hundreds of publishers through the <Link to="/explorer">Explorer</Link> page.</p>
              </Col>
            </Row>
          </Col>
        </Row>
      </Container>
    );
  }
}


export default connect(mapStateToProps, mapDispatchToProps)(Dashboard);
