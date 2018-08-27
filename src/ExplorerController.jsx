import React from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import {
  Row, Col, Button, Label, Form, Input, FormGroup,
} from 'reactstrap';
import { Link } from 'react-router-dom';
import BlockUi from 'react-block-ui';
import { Loader } from 'react-loaders';
import axios from 'axios';
import { Map } from 'immutable';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSearch } from '@fortawesome/free-solid-svg-icons/faSearch';
import { faTimes } from '@fortawesome/free-solid-svg-icons/faTimes';
import { faQuestionCircle } from '@fortawesome/free-solid-svg-icons/faQuestionCircle';
import { SearchFacet, ResultsList } from './explorer';
import { getUser, getAuthenticated, getSelectedDistributions } from './reducers';
import * as snippetActions from "./snippets/actions";

function mapStateToProps(state) {
  return {
    user: getUser(state),
    isAuthenticated: getAuthenticated(state),
    selectedDistributions: getSelectedDistributions(state),
  };
}

function mapDispatchToProps(dispatch) {
  return {
    dispatch,
  };
}

function pagination(currentPage, pageCount) {
  const delta = 2;
  const left = currentPage - delta;
  const right = currentPage + delta + 1;
  let result = [];
  result = Array.from({ length: pageCount }, (v, k) => k + 1)
    .filter(i => i && i >= left && i < right);

  result = result.slice(0, 5);

  // this isn't very solid
  // keeping it for improvement later
  if (result.length > 1) {
    // Add first page and dots
    if (result[0] > 1) {
      result.unshift('First');
    }
    // Add dots and last page
    if (result[result.length - 1] < pageCount) {
      result.push('Last');
    }
  }
  return result;
}

function zeroingMap(instanceMap) {
  let newInstance = Map();
  instanceMap.keySeq().forEach((key) => { newInstance = newInstance.set(key, 0); });
  return newInstance;
}

// const restrictedPubs = [
//   'Geoscience Australia',
//   'Australian Institute of Marine Science (AIMS)',
//   'Office of Environment and Heritage (OEH)',
//   'Natural Resources, Mines and Energy',
//   'State of the Environment',
//   'AGSO-Geoscience Australia'
// ];

export class ExplorerController extends React.Component {
  static propTypes = {
    selectedDistributions: PropTypes.instanceOf(Map),
    dispatch: PropTypes.func.isRequired,
  }

  static defaultProps = {
    selectedDistributions: Map(),
  }

  constructor(props) {
    super(props);
    this.changePage = this.changePage.bind(this);
    this.searchHandler = this.searchHandler.bind(this);
    this.handleKeywordChange = this.handleKeywordChange.bind(this);
    this.handlePerPageChange = this.handlePerPageChange.bind(this);
    this.handleSortChange = this.handleSortChange.bind(this);
    this.restrictedPubs = [];
    this.state = {
      publishers: Map(),
      publishersLoading: true,
      formats: Map(),
      formatsLoading: true,
      results: [],
      resultsLoading: true,
      perpage: 10,
      hits: 0,
      page: 1,
      sort: [],
      selectedSort: 'default',
      search: {
        keywords: '',
      },
      query: {
        aggs: {
          formats: {
            nested: {
              path: 'distributions',
            },
            aggs: {
              formats: {
                terms: {
                  field: 'distributions.format.keyword',
                  size: 25,
                },
              },
            },
          },
          publishers: {
            terms: { field: 'publisher.name.keyword', size: 25 },
          },
        },
        query: {
          bool: {
            must: [
              {
                terms: {
                  'publisher.name.keyword':  this.restrictedPubs, 
                },
              },
              {
                nested: {
                  path: 'distributions',
                  query: {},
                },
              },
            ],
          },
        },
        sort: [],
      }
  
    }
  }

  loadPublishers(){
    axios.get('https://raw.githubusercontent.com/CSIRO-enviro-informatics/workspace-ui/master/config/knv2-publishers.csv')
    .then(res => {
      let rawPublishers = (new Csv()).parse(res.data)
      for(let publisher of rawPublishers){
        if(publisher['Environmental data? Y/N/Part'] === 'Y'){
          this.restrictedPubs.push(publisher['Name'])
        }
      }
      this.getResults()
    })
  }

  

  componentWillMount() {
    
  }

  componentDidMount() {
    console.log('Explorer: work in progress.');
    this.loadPublishers();
    this.loadLicense();
  }

  // componentDidMount() {
  //   console.log('Explorer: work in progress.');
  // }

  getResults() {
    const { query } = this.state;

    query.from = ((this.state.page - 1) * this.state.perpage);
    query.size = this.state.perpage;
    query.sort = this.state.sort;

    axios.post('https://es.knowledgenet.co/datasets32/_search', query)
      .then((res) => {
        this.setState((prevState) => {
          // reset the value to 0
          let freshPublisher = zeroingMap(prevState.publishers);
          let freshFormat = zeroingMap(prevState.formats);
          // update the map value to the aggregated value
          for (let i = 0, len = res.data.aggregations.publishers.buckets.length; i < len; i += 1) {
            const ele = res.data.aggregations.publishers.buckets[i];
            freshPublisher = freshPublisher.set(ele.key, ele.doc_count);
          }
          for (let i = 0, len = res.data.aggregations.formats.formats.buckets.length; i < len; i += 1) {
            const ele = res.data.aggregations.formats.formats.buckets[i];
            freshFormat = freshFormat.set(ele.key, ele.doc_count);
          }
          return {
            results: res.data.hits.hits,
            resultsLoading: false,
            hits: res.data.hits.total,
            publishers: freshPublisher,
            publishersLoading: false,
            formats: freshFormat,
            formatsLoading: false,
          };
        });
      });
  }

  /**
   * Adds a given distribution to the selection set for snippets
   */
  addDistToSelection = (dataset) => {
    this.props.dispatch(snippetActions.selectionAddDistribution(dataset));
  }

  /**
   * Deletes the distribution with the given ID from the selection set for
   * snippets
   */
  deleteDistFromSelection = (id) => {
    this.props.dispatch(snippetActions.selectionDeleteDistribution(id));
  }

  searchHandler = (event) => {
    event.preventDefault();
    const { query } = this.state;
    this.getResults(query);
  }

  handleFacetUpdate = (facetData) => {
    const { type, newSelection } = facetData;
    const { query } = this.state;
    let formats = query.query.bool.must[1].nested.query;
    const pubs = query.query.bool.must[0];

    if (type === 'format') {
      if (newSelection.length > 0) {
        formats.terms = {
          'distributions.format.keyword': newSelection,
        };
      } else {
        formats = {};
      }
      query.query.bool.must[1].nested.query = formats;
    } else if (type === 'publisher') {
      if (newSelection.length > 0) {
        pubs.terms = {
          'publisher.name.keyword': newSelection,
        };
      } else {
        pubs.terms = {
          'publisher.name.keyword': this.state.restrictedPubs,
        };
      }
      query.query.bool.must[0] = pubs;
    }
    this.setState({ query }, () => this.getResults());
  }

  handleKeywordChange(e) {
    // udpate state (used for validation and handling)
    const { search } = this.state;
    search.keywords = e.target.value;
    this.setState({ search });

    // update query (this could be combined in request handler)
    const { query } = this.state;
    if (e.target.value.length > 0) {
      if (query.query.bool.must.length === 2) {
        const keywords = {
          multi_match: {
            query: e.target.value,
            fields: ['catalog', 'description', 'title', 'themes'],
          },
        };
        query.query.bool.must.push(keywords);
      } else {
        // assume any 3-part query is a keyword search
        // TODO: too fragile, fix later
        // update query
        query.query.bool.must[2].multi_match.query = e.target.value;
      }
    } else {
      // empty search is still valid
      // delete object only if it exists
      query.query.bool.must.splice(2);
    }
    this.setState({ query });
  }

  loadLicense() {
    fetch('https://raw.githubusercontent.com/CSIRO-enviro-informatics/licences-register/master/licences.json')
      .then(res => res.json())
      .then((json) => {
        // console.log(json)
        this.setState({ license: json });
      });
  }

  handlePerPageChange(e) {
    this.setState({ perpage: e.target.value }, () => this.getResults());
  }

  handleSortChange(e) {
    const selectedSort = e.target.value;
    const attr = selectedSort.split('-')[0];
    const order = selectedSort.split('-')[1];
    let sort = [];
    if (attr !== 'default') {
      const sortOption = {
        [attr]: {
          order,
        },
      };
      sort.push(sortOption);
    } else {
      sort = [];
    }
    this.setState({ sort, selectedSort }, () => this.getResults());
  }

  changePage(n) {
    const page = n;
    this.setState({ page }, () => this.getResults());
  }

  renderPageButtons() {
    const { page, hits, perpage } = this.state;
    const last = Math.ceil(hits / perpage);
    const pages = pagination(page, last);
    const pageButtons = pages.map((pageNo) => {
      if (pageNo === 'First') {
        return <Button color="primary" size="sm" key={pageNo} onClick={() => this.changePage(1)}>&laquo;</Button>;
      }
      if (pageNo === 'Last') {
        return <Button color="primary" size="sm" key={pageNo} onClick={() => this.changePage(last)}>&raquo;</Button>;
      }
      return <Button color="primary" size="sm" key={pageNo} onClick={() => this.changePage(pageNo)} className={(pageNo === this.state.page) ? 'active' : ''} disabled={(pageNo === this.state.page)}>{pageNo}</Button>;
    });

    return pageButtons;
  }

  render() {
    // const {
    //   user, isAuthenticated,
    // } = this.props;

    return (
      <section className="explorer">
        <Row className="search-header">
          <Col lg="3" md="12">
            <Col sm="12">
              <span className="results-count"><strong>{this.state.hits} Results</strong></span>
            </Col>
          </Col>
          <Col lg="9" md="12">
            <Form inline onSubmit={this.searchHandler}>
              <Col lg="7" md="12">
                <Input type="text" name="search" id="searchTerms" placeholder="Enter search terms ..." value={this.state.search.keywords} onChange={this.handleKeywordChange} />
                <Button><FontAwesomeIcon icon={faSearch} /> Search</Button>
              </Col>
              <Col lg="5" md="12">
                <FormGroup className="sorts">
                  <Label for="sortBy">Sort:</Label>
                  <Input type="select" name="sortBy" id="sortBy" value={this.state.selectedSort} onChange={this.handleSortChange}>
                    <option value="default">Default</option>
                    <option value="indexed-desc" data-order="desc">Indexed (Desc)</option>
                    <option value="indexed-asc" data-order="asc">Indexed (Asc)</option>
                    <option value="modified-desc" data-order="desc">Modified (Desc)</option>
                    <option value="modified-asc" data-order="asc">Modified (Asc)</option>
                    <option value="issued-desc" data-order="desc">Issued (Desc)</option>
                    <option value="issued-asc" data-order="asc">Issued (Asc)</option>
                  </Input>
                  <Label for="resultsNum">Per Page:</Label>
                  <Input type="select" name="resultsNum" id="resultsNum" value={this.state.perpage} onChange={this.handlePerPageChange}>
                    <option>10</option>
                    <option>25</option>
                    <option>50</option>
                  </Input>
                </FormGroup>
              </Col>
            </Form>
          </Col>
        </Row>
        <Row className="search-body">
          <Col lg="3" md="12">
            <aside className="search-sidebar-panel facets">
              <header>
                Refine Search
              </header>
              <div className="sidebar-body">
                <BlockUi blocking={this.state.publishersLoading} loader={<Loader active type="ball-pulse" />}>
                  <SearchFacet title="Publisher" type="publisher" options={this.state.publishers} onUpdate={this.handleFacetUpdate} />
                </BlockUi>
                <BlockUi blocking={this.state.formatsLoading} loader={<Loader active type="ball-pulse" />}>
                  <SearchFacet title="Resource Type" type="format" options={this.state.formats} onUpdate={this.handleFacetUpdate} />
                </BlockUi>
              </div>
            </aside>
          </Col>
          <Col lg="9" md="12">
            <div className="selected">
              <h4>Datasets Selected: { this.props.selectedDistributions.size }</h4>
              <a href="#" className="help-link"><FontAwesomeIcon icon={faQuestionCircle} /> How Do I Use This Selection?</a>
              <Link to="/snippets" params={{ selectedDistributions: this.state.selectedDistributions }} className="btn btn-primary float-right">View Snippets </Link>
              <ul className="selected-datasets">
                {
                  [...this.props.selectedDistributions.values()].map(dist => (
                    <li key={dist.identifier}><a className="selected-dataset"> { dist.title } <FontAwesomeIcon onClick={() => this.deleteDistFromSelection(dist.identifier)} icon={faTimes} /></a></li>
                  ))
                }
              </ul>
            </div>
            <BlockUi tag="div" blocking={this.state.resultsLoading} loader={<Loader active type="ball-pulse" />}>
              <div className="results-list">
                <header>
                  <div className="pagination">
                    <span className="pages">Page {this.state.page} / { Math.ceil(this.state.hits / this.state.perpage) }</span>
                    { this.renderPageButtons() }
                  </div>
                </header>
                <ResultsList data={this.state.results} license={this.state.license} addDistToSelection={this.addDistToSelection} deleteDistFromSelection={this.deleteDistFromSelection} selectedDistributions={this.props.selectedDistributions} />

                <footer>
                  <div className="pagination">
                    <span className="pages">Page {this.state.page} / { Math.ceil(this.state.hits / this.state.perpage) }</span>
                    { this.renderPageButtons() }
                  </div>
                </footer>
              </div>
            </BlockUi>
          </Col>
        </Row>
      </section>
    );
  }
}


export default connect(mapStateToProps, mapDispatchToProps)(ExplorerController);


//https://lowrey.me/parsing-a-csv-file-in-es6-javascript/
class Csv {
  parseLine(text) {
    const regex =
    /(?!\s*$)\s*(?:'([^'\\]*(?:\\[\S\s][^'\\]*)*)'|"([^"\\]*(?:\\[\S\s][^"\\]*)*)"|([^,'"\s\\]*(?:\s+[^,'"\s\\]+)*))\s*(?:,|$)/g;
    let arr = [];
    text.replace(regex, (m0, m1, m2, m3) => {
      if (m1 !== undefined) {
        arr.push(m1.replace(/\\'/g, "'"));
      } else if (m2 !== undefined) {
        arr.push(m2.replace(/\\"/g, "\""));
      } else if (m3 !== undefined) {
        arr.push(m3);
      }
      return "";
    });
    if (/,\s*$/.test(text)) {
      arr.push("");
    }
    return arr;
  }

  zipObject(props, values) {
    return props.reduce((prev, prop, i) => {
      prev[prop] = values[i];
      return prev;
    }, {});
  }

  parse(csv) {
    let [properties, ...data] = csv.split("\n").map(this.parseLine);
    return data.map((line) => this.zipObject(properties, line))
  };

  serialize(obj) {
    let fields = Object.keys(obj[0]);
    let csv = obj.map(row => fields.map((fieldName) => JSON.stringify(row[fieldName] || "")));
    return [fields, ...csv].join("\n");
  }; 
}