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
import { Map, Set } from 'immutable';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSearch } from '@fortawesome/free-solid-svg-icons/faSearch';
import { faTimes } from '@fortawesome/free-solid-svg-icons/faTimes';
import { SearchFacet, ResultsList } from './explorer';
import { getUser, getAuthenticated, getSelectedDistributions } from './reducers';
import * as snippetActions from './snippets/actions';
import { getConfig } from './config';

// https://lowrey.me/parsing-a-csv-file-in-es6-javascript/

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

/**
 * Zeros the `count` property of the associated key of each entry in the given
 * map
 *
 * @param {Map<string, { name: string, count: number }>} instanceMap
 */
function zeroingMap(instanceMap) {
  return instanceMap.map((value) => {
    if (value === undefined) {
      throw new Error('No value defined for a certain key in given map');
    }

    return {
      ...value,
      count: 0,
    };
  });
}

/**
 * Generates a new object that represents the body of an ElasticSearch query to
 * KnowledgeNet
 *
 * @param {number} pageSize Number of items to return for each page
 * @param {number} pageIndex 0-based index of the page to query for
 * @param {any[]} sort Sorting array
 */
function generateBaselineQueryObject(pageSize, pageIndex, sort) {
  return {
    aggs: {
      formats: {
        nested: {
          path: 'distributions',
        },
        aggs: {
          formats: {
            terms: {
              field: 'distributions.format.keyword',
              size: 10000,
            },
          },
        },
      },
      publishers: {
        terms: {
          field: 'publisher.name.keyword',
          size: 10000,
        },
      },
    },
    query: {
      bool: {
        /** @type {any[]} */
        must: [
          // This blank object here is to maintain the index order that exists
          // in the code at the moment; this has been noted to be removed
          {},
          {
            nested: {
              path: 'distributions',
              query: {},
            },
          },
        ],
      },
    },

    from: pageIndex * pageSize,
    size: pageSize,
    sort,
  };
}

/**
 * Sorting function for facets
 *
 * @param {{ name: string, count: number }} a
 * @param {{ name: string, count: number }} b
 */
function facetDefaultSortFunc(a, b) {
  const aCount = a.count;
  const bCount = b.count;

  // Sort by count first
  if (aCount !== bCount) {
    return bCount - aCount;
  }

  // If counts are equal, sort by name
  return a.name.localeCompare(b.name);
}

/**
 * @returns {string} Elasticsearch query URL for Explorer dataset search
 */
function getEsServerUrl() {
  return getConfig('explorer').esServerUrl;
}

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

    this.state = {
      /**
       * Map of publisher ID to an object representing the name and returned
       * item count
       *
       * @type {Map<string, { name: string, count: number }>}
       */
      publishers: Map(),
      publishersLoading: true,

      /**
       * Map of format ID to an object representing the name and returned item
       * count
       *
       * @type {Map<string, { name: string, count: number }>}
       */
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

      /** @type {object} */
      query: undefined,

      /** Contains IDs of selected publishers in facet */
      selectedPublishers: Set(),

      /** Contains IDs of selected formats in facet */
      selectedFormats: Set(),
    };

    // Initialise the state query object
    const {
      perpage: pageSize,
      page,
      sort,
    } = this.state;

    this.state.query = generateBaselineQueryObject(pageSize, page - 1, sort);
  }

  componentWillMount() {

  }

  componentDidMount() {
    console.warn('Explorer: work in progress.');

    this.loadLicense()
      .then(() => this.getResults());
  }

  getResults() {
    const query = this.generateQueryObject();

    axios.post(getEsServerUrl(), query)
      .then((res) => {
        this.setState((prevState) => {
          // reset the value to 0
          let freshPublisher = zeroingMap(prevState.publishers);
          let freshFormat = zeroingMap(prevState.formats);

          // update the map value to the aggregated value
          const publishers = res.data.aggregations.publishers.buckets;
          const formats = res.data.aggregations.formats.formats.buckets;

          publishers.forEach((pub) => {
            freshPublisher = freshPublisher.set(pub.key, { name: pub.key, count: pub.doc_count });
          });

          formats.forEach((f) => {
            freshFormat = freshFormat.set(f.key, { name: f.key, count: f.doc_count });
          });

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
  addDistToSelection = (distribution) => {
    this.props.dispatch(snippetActions.selectionAddDistribution(distribution));
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

    // Trigger search now
    this.getResults();
  }

  generateQueryObject() {
    const {
      perpage: pageSize,
      page,
      sort,
      selectedPublishers,
      selectedFormats,
      search,
    } = this.state;

    const query = generateBaselineQueryObject(pageSize, page - 1, sort);

    // TODO: References to the various query objects in the `must` array should
    // be changed so that they're not as brittle with the hard index references
    // at the moment

    // Populate selected search facets (formats, publishers)
    if (selectedFormats.size === 0) {
      // Delete the object at index 1 out of the `bool.must` array
      query.query.bool.must.splice(1, 1);
    } else {
      query.query.bool.must[1].nested.query = {
        terms: {
          'distributions.format.keyword': selectedFormats.toArray(),
        },
      };
    }

    if (selectedPublishers.size === 0) {
      // Delete the object at index 0 out of the `bool.must` array
      query.query.bool.must.splice(0, 1);
    } else {
      query.query.bool.must[0] = {
        terms: {
          'publisher.name.keyword': selectedPublishers.toArray(),
        },
      };
    }

    // Populate search term if available
    if (search.keywords.length > 0) {
      const keywords = {
        multi_match: {
          query: search.keywords,
          fields: ['catalog', 'description', 'title', 'themes'],
        },
      };

      query.query.bool.must.push(keywords);
    }

    return query;
  }

  /**
   * Factory for facet update handler
   *
   * @param {"publisher" | "format"} type
   */
  generateFacetUpdateHandler(type) {
    return (data) => {
      /** @type {Set<string>} */
      let selectionSet;

      switch (type) {
        case 'format':
          selectionSet = this.state.selectedFormats;
          break;
        case 'publisher':
          selectionSet = this.state.selectedPublishers;
          break;
        default:
          throw new Error('Unknown type');
      }

      // Add or remove from set
      const { id, checked } = data;

      if (checked) {
        selectionSet = selectionSet.add(id);
      } else {
        selectionSet = selectionSet.delete(id);
      }

      // Update state and trigger fetch once done
      //
      // Note that we should reset the page counter back so that we don't end up
      // with changes in the facets causing users to be stranded on a page that
      // is beyond the actual number of available pages
      switch (type) {
        case 'format':
          this.setState({ selectedFormats: selectionSet, page: 1 }, () => this.getResults());
          break;

        case 'publisher':
          this.setState({ selectedPublishers: selectionSet, page: 1 }, () => this.getResults());
          break;

        default:
          throw new Error('Unknown type');
      }
    };
  }

  generateFacetResetHandler(type) {
    return () => {
      // Wipe the relevant set
      switch (type) {
        case 'format':
          this.setState({ selectedFormats: Set() }, () => this.getResults());
          break;

        case 'publisher':
          this.setState({ selectedPublishers: Set() }, () => this.getResults());
          break;

        default:
          throw new Error('Unknown type');
      }
    };
  }

  handleKeywordChange(e) {
    // udpate state (used for validation and handling)
    const { search } = this.state;
    search.keywords = e.target.value;
    this.setState({ search });
  }

  loadLicense() {
    return fetch('https://raw.githubusercontent.com/CSIRO-enviro-informatics/licences-register/master/licences.json')
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

  // TODO: to avoid arrow functions in onClick we have to make the pager buttons their own component
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

    const { publishers, formats } = this.state;

    const searchFacetPublishers = publishers.entrySeq()
      .map(([id, v]) => ({ id, ...v }))
      .toArray()
      .sort(facetDefaultSortFunc);

    const searchFacetFormats = formats.entrySeq()
      .map(([id, v]) => ({ id, ...v }))
      .toArray()
      .sort(facetDefaultSortFunc);

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
                  <SearchFacet
                    title="Publisher"
                    items={searchFacetPublishers}
                    selectedItems={this.state.selectedPublishers}
                    onUpdate={this.generateFacetUpdateHandler('publisher')}
                    onReset={this.generateFacetResetHandler('publisher')}
                  />
                </BlockUi>
                <BlockUi blocking={this.state.formatsLoading} loader={<Loader active type="ball-pulse" />}>
                  <SearchFacet
                    title="Resource Type"
                    items={searchFacetFormats}
                    selectedItems={this.state.selectedFormats}
                    onUpdate={this.generateFacetUpdateHandler('format')}
                    onReset={this.generateFacetResetHandler('format')}
                  />
                </BlockUi>
              </div>
            </aside>
          </Col>
          <Col lg="9" md="12">
            <div className="selected">
              <h4>Datasets Selected: {this.props.selectedDistributions.size}</h4>
              <Link to="/snippets" params={{ selectedDistributions: this.state.selectedDistributions }} className="btn btn-primary float-right">View Snippets </Link>
              <ul className="selected-datasets">
                {
                  [...this.props.selectedDistributions.values()].map(dist => (
                    <li key={dist.identifier}><a className="selected-dataset"> {dist.title} <FontAwesomeIcon onClick={() => this.deleteDistFromSelection(dist.identifier)} icon={faTimes} /></a></li>
                  ))
                }
              </ul>
            </div>
            <BlockUi tag="div" blocking={this.state.resultsLoading} loader={<Loader active type="ball-pulse" />}>
              <div className="results-list">
                <header>
                  <div className="pagination">
                    <span className="pages">Page {this.state.page} / {Math.ceil(this.state.hits / this.state.perpage)}</span>
                    {this.renderPageButtons()}
                  </div>
                </header>
                <ResultsList
                  data={this.state.results}
                  license={this.state.license}
                  addDistToSelection={this.addDistToSelection}
                  deleteDistFromSelection={this.deleteDistFromSelection}
                  selectedDistributions={this.props.selectedDistributions}
                />

                <footer>
                  <div className="pagination">
                    <span className="pages">Page {this.state.page} / {Math.ceil(this.state.hits / this.state.perpage)}</span>
                    {this.renderPageButtons()}
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
