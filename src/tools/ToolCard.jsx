import React from 'react';
import PropTypes from 'prop-types';
import {
  Card,
  CardBody,
  CardTitle,
  CardText,
} from 'reactstrap';

class ToolCard extends React.PureComponent {
  static propTypes = {
    title: PropTypes.string.isRequired,
    description: PropTypes.string,
    url: PropTypes.string.isRequired,
    imageSource: PropTypes.string,
    imageAltText: PropTypes.string,
    openInNewWindow: PropTypes.bool,
  }

  static defaultProps = {
    description: undefined,
    imageSource: undefined,
    imageAltText: '',
    openInNewWindow: true,
  }

  render() {
    const linkProps = {};

    if (this.props.openInNewWindow) {
      linkProps.target = '_blank';
      linkProps.rel = 'noopener noreferrer';
    }

    return (
      <Card className="tool-card">
        <CardBody>
          <CardTitle>
            {this.props.imageSource && <img className="card-logo" src={this.props.imageSource} alt={this.props.imageAltText} />}
            <a href={this.props.url} {...linkProps}>{this.props.title}</a>
          </CardTitle>
          {this.props.description && (
            <CardText>
              {this.props.description}
            </CardText>
          )}
        </CardBody>
      </Card>
    );
  }
}

export default ToolCard;
